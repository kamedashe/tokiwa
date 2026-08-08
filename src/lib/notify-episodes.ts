import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { sendTelegramMessage, telegramEnabled } from "@/lib/telegram";
import { sendEmail, emailEnabled } from "@/lib/email";
import { sendPush, pushEnabled } from "@/lib/push";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { FALLBACK_DURATION_MIN } from "@/lib/backlog";

/** И Telegram, и HTML писем размечаются — названия приходят извне, экранируем. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface FreshEntry {
  id: string;
  progress: number;
  slug: string;
  name: string;
  aired: number;
  durationMin: number | null;
}

/**
 * «Вышли новые серии» — каждому своим каналом: привязавшим Telegram — в бота,
 * остальным — письмо на почту из OAuth (если не отписались). Запускается
 * после обновления онгоингов теми же кронами.
 *
 * Антидубль — notifiedEpisode на записи списка, общий для обоих каналов:
 * уведомляем, только когда вышедших серий стало больше и чем прогресс, и чем
 * прошлое уведомление. Prisma не сравнивает колонку с колонкой — фильтр в
 * коде, объёмы копеечные.
 */
export async function notifyNewEpisodes({ budgetMs = 10_000 }: { budgetMs?: number } = {}) {
  if (!telegramEnabled() && !emailEnabled() && !pushEnabled())
    return { tg: 0, mail: 0, push: 0, skipped: "disabled" as const };

  const deadline = Date.now() + budgetMs;

  // Один проход по всем «смотрю»-записям разом: раньше был запрос на каждого
  // пользователя, и в день выхода популярной серии бюджет сгорал на сканах,
  // не дойдя до отправки. Записей со статусом «смотрю» — сотни, это дёшево.
  const entries = await prisma.watchlistEntry.findMany({
    where: {
      status: "watching",
      title: {
        episodesAired: { not: null },
        // Только выходящие. Иначе, когда синк впервые проставит число серий
        // давно законченному тайтлу, это выглядит как «вышла новая серия»:
        // 28.07.2026 люди получили письма про 366-ю серию Блича.
        status: "releasing",
      },
      // Гостей больше не отсекаем: почты у них нет, но пуш в браузер есть —
      // для них это единственный способ узнать о новой серии.
    },
    select: {
      id: true,
      progress: true,
      notifiedEpisode: true,
      userId: true,
      title: {
        select: { slug: true, title: true, titleRu: true, episodesAired: true, durationMin: true },
      },
      user: {
        select: {
          email: true,
          emailNotifications: true,
          isGuest: true,
          telegramLink: { select: { chatId: true } },
          _count: { select: { pushSubs: true } },
        },
      },
    },
  });

  // Группируем свежие серии по получателям.
  const byUser = new Map<
    string,
    { chatId: bigint | null; email: string | null; canPush: boolean; fresh: FreshEntry[] }
  >();

  for (const e of entries) {
    const aired = e.title.episodesAired!;
    if (aired <= e.progress || aired <= e.notifiedEpisode) continue;

    const chatId = e.user.telegramLink?.chatId ?? null;
    const canMail =
      emailEnabled() && !e.user.isGuest && e.user.emailNotifications && Boolean(e.user.email);
    const canPush = pushEnabled() && e.user._count.pushSubs > 0;
    if (!chatId && !canMail && !canPush) continue;

    const box = byUser.get(e.userId) ?? {
      chatId,
      email: e.user.email,
      canPush,
      fresh: [],
    };
    box.fresh.push({
      id: e.id,
      progress: e.progress,
      slug: e.title.slug,
      name: e.title.titleRu ?? e.title.title,
      aired,
      durationMin: e.title.durationMin,
    });
    byUser.set(e.userId, box);
  }

  let tg = 0;
  let mail = 0;
  let push = 0;

  for (const [userId, { chatId, email, canPush, fresh }] of byUser) {
    if (Date.now() > deadline) break;

    // Пуш идёт всегда, когда подписка есть: он приходит на экран, а не в
    // ящик, и не конкурирует с письмом, а дополняет его.
    if (canPush) {
      const delivered = await sendPush(userId, {
        title: fresh.length === 1 ? fresh[0].name : "Вышли новые серии",
        body:
          fresh.length === 1
            ? `Серия ${fresh[0].aired} · вы на ${fresh[0].progress}`
            : `${fresh.length} ваших тайтлов`,
        url: fresh.length === 1 ? `${SITE_URL}/anime/${fresh[0].slug}` : `${SITE_URL}/my`,
        tag: fresh.length === 1 ? fresh[0].slug : "episodes",
      });
      if (delivered > 0) push++;
    }

    const ok = chatId
      ? await sendTelegram(chatId, fresh)
      : email
        ? await sendMail(userId, email, fresh)
        : canPush;

    if (ok) {
      if (chatId) tg++;
      else if (email) mail++;
      // Отметки — только после успешной отправки, иначе уведомление потеряется.
      // Сырой SQL, а не update: Prisma при update освежает updatedAt, а на нём
      // строится статистика возвратов — системная отметка не «визит».
      await Promise.all(
        fresh.map(
          (e) =>
            prisma.$executeRaw`UPDATE "WatchlistEntry" SET "notifiedEpisode" = ${e.aired} WHERE "id" = ${e.id}`,
        ),
      );
      // Пауза под лимит Resend (2 письма/сек) — телеграму она не мешает.
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  return { tg, mail, push };
}

function sendTelegram(chatId: bigint, fresh: FreshEntry[]): Promise<boolean> {
  const lines = fresh.map(
    (e) =>
      `• <a href="${SITE_URL}/anime/${e.slug}">${escapeHtml(e.name)}</a> — серия ${e.aired} (вы на ${e.progress})`,
  );
  return sendTelegramMessage(chatId, `🔔 <b>Вышли новые серии</b>\n\n${lines.join("\n")}`);
}

/**
 * Тестовое письмо с демо-данными — проверить вёрстку и доставку, не дожидаясь
 * настоящих серий. Дёргается ручкой /api/test-email за секретом синков.
 */
export async function sendTestEpisodeMail(to: string): Promise<boolean> {
  const user = await prisma.user.findFirst({ where: { email: to }, select: { id: true } });

  return sendMail(user?.id ?? "test", to, [
    {
      id: "demo-1",
      progress: 5,
      slug: "frieren-beyond-journey-s-end",
      name: "Провожающая в последний путь Фрирен",
      aired: 7,
      durationMin: 24,
    },
    {
      id: "demo-2",
      progress: 1,
      slug: "one-piece",
      name: "Ван-Пис",
      aired: 3,
      durationMin: 24,
    },
  ]);
}

/**
 * Метка перехода из письма. Без неё письма неотличимы от прямых заходов:
 * почтовые клиенты referrer не передают, и вечерний всплеск трафика нельзя
 * отделить от обычного вечернего пика.
 */
function tagged(path: string): string {
  return `${SITE_URL}${path}?utm_source=email&utm_medium=notification&utm_campaign=new-episodes`;
}

function sendMail(userId: string, email: string, fresh: FreshEntry[]): Promise<boolean> {
  const unsub = unsubscribeUrl(userId);

  const rows = fresh
    .map((e) => {
      const behind = e.aired - e.progress;
      const catchUp = behind * (e.durationMin ?? FALLBACK_DURATION_MIN);
      return `<tr>
<td style="padding:10px 0;border-bottom:1px solid #26262e">
  <a href="${tagged(`/anime/${e.slug}`)}" style="color:#f3f3f6;font-weight:600;text-decoration:none">${escapeHtml(e.name)}</a>
  <div style="color:#9a9aa6;font-size:13px;margin-top:2px">
    серия ${e.aired} · вы на ${e.progress} · догнать ≈ ${catchUp} мин
  </div>
</td></tr>`;
    })
    .join("");

  const subject =
    fresh.length === 1
      ? `Вышла серия ${fresh[0].aired} — ${fresh[0].name}`
      : `Вышли новые серии — ${fresh.length} ваших тайтлов`;

  // Инлайн-стили и таблицы: почтовые клиенты ничего другого не понимают.
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#050506">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050506">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;font-family:system-ui,-apple-system,sans-serif">
  <tr><td style="color:#f3f3f6;font-size:20px;font-weight:800;padding-bottom:4px">
    TokiWa<span style="color:#ffb020">.</span>
  </td></tr>
  <tr><td style="color:#ffb020;font-size:13px;letter-spacing:2px;padding:16px 0 4px">ВЫШЛИ НОВЫЕ СЕРИИ</td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
  <tr><td align="center" style="padding:24px 0">
    <a href="${tagged("/my")}" style="display:inline-block;background:#ffb020;color:#050506;font-weight:700;font-size:14px;text-decoration:none;padding:10px 24px;border-radius:999px">Открыть мой список</a>
  </td></tr>
  <tr><td style="color:#5c5c66;font-size:12px;padding-top:8px;border-top:1px solid #26262e">
    Письмо пришло, потому что у тайтлов из вашего списка «смотрю» вышли серии.
    <a href="${unsub}" style="color:#9a9aa6">Отписаться</a>
  </td></tr>
</table>
</td></tr></table></body></html>`;

  return sendEmail({ to: email, subject, html, unsubscribeUrl: unsub });
}
