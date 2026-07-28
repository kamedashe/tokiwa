import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { sendTelegramMessage, telegramEnabled } from "@/lib/telegram";
import { sendEmail, emailEnabled } from "@/lib/email";
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
  if (!telegramEnabled() && !emailEnabled()) return { tg: 0, mail: 0, skipped: "disabled" as const };

  const deadline = Date.now() + budgetMs;

  // Только настоящие аккаунты со «смотрю»: гостям слать некуда — почты нет.
  const users = await prisma.user.findMany({
    where: { isGuest: false, watchlist: { some: { status: "watching" } } },
    select: {
      id: true,
      email: true,
      emailNotifications: true,
      telegramLink: { select: { chatId: true } },
    },
  });

  let tg = 0;
  let mail = 0;

  for (const user of users) {
    if (Date.now() > deadline) break;

    const chatId = user.telegramLink?.chatId ?? null;
    const canMail = emailEnabled() && user.emailNotifications && Boolean(user.email);
    if (!chatId && !canMail) continue;

    const entries = await prisma.watchlistEntry.findMany({
      where: {
        userId: user.id,
        status: "watching",
        title: { episodesAired: { not: null } },
      },
      select: {
        id: true,
        progress: true,
        notifiedEpisode: true,
        title: {
          select: { slug: true, title: true, titleRu: true, episodesAired: true, durationMin: true },
        },
      },
    });

    const fresh: FreshEntry[] = entries
      .filter((e) => {
        const aired = e.title.episodesAired!;
        return aired > e.progress && aired > e.notifiedEpisode;
      })
      .map((e) => ({
        id: e.id,
        progress: e.progress,
        slug: e.title.slug,
        name: e.title.titleRu ?? e.title.title,
        aired: e.title.episodesAired!,
        durationMin: e.title.durationMin,
      }));

    if (fresh.length === 0) continue;

    const ok = chatId
      ? await sendTelegram(chatId, fresh)
      : await sendMail(user.id, user.email!, fresh);

    if (ok) {
      chatId ? tg++ : mail++;
      // Отметки — только после успешной отправки, иначе уведомление потеряется.
      await Promise.all(
        fresh.map((e) =>
          prisma.watchlistEntry.update({
            where: { id: e.id },
            data: { notifiedEpisode: e.aired },
          }),
        ),
      );
      // Пауза под лимит Resend (2 письма/сек) — телеграму она не мешает.
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  return { tg, mail };
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

function sendMail(userId: string, email: string, fresh: FreshEntry[]): Promise<boolean> {
  const unsub = unsubscribeUrl(userId);

  const rows = fresh
    .map((e) => {
      const behind = e.aired - e.progress;
      const catchUp = behind * (e.durationMin ?? FALLBACK_DURATION_MIN);
      return `<tr>
<td style="padding:10px 0;border-bottom:1px solid #26262e">
  <a href="${SITE_URL}/anime/${e.slug}" style="color:#f3f3f6;font-weight:600;text-decoration:none">${escapeHtml(e.name)}</a>
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
    <a href="${SITE_URL}/my" style="display:inline-block;background:#ffb020;color:#050506;font-weight:700;font-size:14px;text-decoration:none;padding:10px 24px;border-radius:999px">Открыть мой список</a>
  </td></tr>
  <tr><td style="color:#5c5c66;font-size:12px;padding-top:8px;border-top:1px solid #26262e">
    Письмо пришло, потому что у тайтлов из вашего списка «смотрю» вышли серии.
    <a href="${unsub}" style="color:#9a9aa6">Отписаться</a>
  </td></tr>
</table>
</td></tr></table></body></html>`;

  return sendEmail({ to: email, subject, html, unsubscribeUrl: unsub });
}
