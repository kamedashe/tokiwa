import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { sendTelegramMessage, telegramEnabled } from "@/lib/telegram";
import { sendEmail, emailEnabled } from "@/lib/email";
import { sendPush, pushEnabled } from "@/lib/push";
import { unsubscribeUrl } from "@/lib/unsubscribe";

/**
 * «У тайтла, который вы посмотрели, вышла новая часть» — единственная дыра,
 * которую не закрывают обычные уведомления о сериях: те смотрят только на
 * статус «смотрю», а сиквел или OVA — это вообще другая строка в базе, без
 * которой не с чем сверять вышедшие серии. Без этого модуля человек,
 * отметивший тайтл «посмотрел», выпадал из уведомлений навсегда, даже если
 * франшиза продолжилась через годы — и вечно держать статус «смотрю» ради
 * подстраховки никто не станет.
 *
 * Триггер — не создание тайтла, а момент, когда его связи с остальной
 * франшизой становятся известны: `relatedSyncedAt` тайтл получает ровно
 * один раз, при первом обходе его связей. Для только что вышедшего сиквела
 * это тот самый момент, когда сайт узнаёт, что он вообще существует рядом
 * со старой частью. Лукбэк в три дня — с запасом на дневной крон и паузы
 * между прогонами.
 */
const LOOKBACK_DAYS = 3;

interface Kin {
  id: number;
  slug: string;
  titleRu: string | null;
  title: string;
}

export async function notifyFranchiseUpdates({ budgetMs = 10_000 }: { budgetMs?: number } = {}) {
  if (!telegramEnabled() && !emailEnabled() && !pushEnabled())
    return { tg: 0, mail: 0, push: 0, skipped: "disabled" as const };

  const deadline = Date.now() + budgetMs;
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  // Свежесвязанные тайтлы — те, чьи связи с франшизой узнали недавно.
  // Условие на related/relatedBy отсекает большинство: у каталога связи есть
  // не у всех, и без фильтра пришлось бы перебирать все тайтлы за три дня.
  const freshTitles = await prisma.title.findMany({
    where: {
      relatedSyncedAt: { gte: since },
      OR: [{ related: { some: {} } }, { relatedBy: { some: {} } }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      titleRu: true,
      related: { select: { id: true } },
      relatedBy: { select: { id: true } },
    },
  });
  if (freshTitles.length === 0) return { tg: 0, mail: 0, push: 0 };

  const kinToNew = new Map<number, Kin[]>();
  for (const t of freshTitles) {
    const newPart: Kin = { id: t.id, slug: t.slug, titleRu: t.titleRu, title: t.title };
    for (const kin of [...t.related, ...t.relatedBy]) {
      (kinToNew.get(kin.id) ?? kinToNew.set(kin.id, []).get(kin.id)!).push(newPart);
    }
  }

  // У кого эти старые части стоят «посмотрел» — им и рассказываем.
  const watchers = await prisma.watchlistEntry.findMany({
    where: { status: "completed", titleId: { in: [...kinToNew.keys()] } },
    select: {
      userId: true,
      titleId: true,
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

  // Кому что рассказать: один человек мог досмотреть несколько частей одной
  // франшизы, а франшиза — обзавестись сразу несколькими новыми. Дубли по
  // новому тайтлу схлопываем, дальше решает уникальный индекс в базе.
  const byUser = new Map<
    string,
    { chatId: bigint | null; email: string | null; canPush: boolean; parts: Map<number, Kin> }
  >();

  for (const w of watchers) {
    const parts = kinToNew.get(w.titleId);
    if (!parts) continue;

    const chatId = w.user.telegramLink?.chatId ?? null;
    const canMail =
      emailEnabled() && !w.user.isGuest && w.user.emailNotifications && Boolean(w.user.email);
    const canPush = pushEnabled() && w.user._count.pushSubs > 0;
    if (!chatId && !canMail && !canPush) continue;

    const box = byUser.get(w.userId) ?? {
      chatId,
      email: w.user.email,
      canPush,
      parts: new Map<number, Kin>(),
    };
    for (const p of parts) box.parts.set(p.id, p);
    byUser.set(w.userId, box);
  }

  if (byUser.size === 0) return { tg: 0, mail: 0, push: 0 };

  // Уже сообщённое отсекаем разом, не по одному: за три дня лукбэка кандидатов
  // немного, но без этого шага один и тот же сиквел писал бы человеку каждый
  // прогон крона, пока не истечёт окно.
  const candidateIds = new Set<number>();
  for (const box of byUser.values()) for (const id of box.parts.keys()) candidateIds.add(id);

  const already = await prisma.franchiseAlert.findMany({
    where: { userId: { in: [...byUser.keys()] }, titleId: { in: [...candidateIds] } },
    select: { userId: true, titleId: true },
  });
  const alertedKey = new Set(already.map((a) => `${a.userId}:${a.titleId}`));

  let tg = 0;
  let mail = 0;
  let push = 0;

  for (const [userId, { chatId, email, canPush, parts }] of byUser) {
    if (Date.now() > deadline) break;

    const fresh = [...parts.values()].filter((p) => !alertedKey.has(`${userId}:${p.id}`));
    if (fresh.length === 0) continue;

    if (canPush) {
      const delivered = await sendPush(userId, {
        title: fresh.length === 1 ? "Вышла новая часть" : "Вышли новые части",
        body:
          fresh.length === 1
            ? nameOf(fresh[0])
            : `${fresh.length} франшиз, которые вы смотрели`,
        url: fresh.length === 1 ? `${SITE_URL}/anime/${fresh[0].slug}` : `${SITE_URL}/my`,
        tag: "franchise",
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
    }

    // Отмечаем независимо от исхода: событие разовое, не число серий,
    // которое можно досчитать в следующий раз, — а без отметки тот же
    // кандидат перепроверялся бы на каждый прогон крона все три дня лукбэка,
    // и при живом пуше слал бы дубли, пока не выпадет из окна.
    await prisma.franchiseAlert.createMany({
      data: fresh.map((p) => ({ userId, titleId: p.id })),
      skipDuplicates: true,
    });
    await new Promise((r) => setTimeout(r, 600));
  }

  return { tg, mail, push };
}

function nameOf(k: Kin): string {
  return k.titleRu ?? k.title;
}

function sendTelegram(chatId: bigint, parts: Kin[]): Promise<boolean> {
  const lines = parts.map((p) => `• <a href="${SITE_URL}/anime/${p.slug}">${escapeHtml(nameOf(p))}</a>`);
  return sendTelegramMessage(
    chatId,
    `🎬 <b>Вышла новая часть того, что вы смотрели</b>\n\n${lines.join("\n")}`,
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sendMail(userId: string, email: string, parts: Kin[]): Promise<boolean> {
  const unsub = unsubscribeUrl(userId);

  const rows = parts
    .map(
      (p) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid #26262e">
  <a href="${SITE_URL}/anime/${p.slug}?utm_source=email&utm_medium=notification&utm_campaign=franchise" style="color:#f3f3f6;font-weight:600;text-decoration:none">${escapeHtml(nameOf(p))}</a>
</td></tr>`,
    )
    .join("");

  const subject =
    parts.length === 1
      ? `Вышла новая часть: ${nameOf(parts[0])}`
      : `Вышли новые части — ${parts.length} франшиз из вашего списка`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#050506">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050506">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;font-family:system-ui,-apple-system,sans-serif">
  <tr><td style="color:#f3f3f6;font-size:20px;font-weight:800;padding-bottom:4px">
    TokiWa<span style="color:#ffb020">.</span>
  </td></tr>
  <tr><td style="color:#ffb020;font-size:13px;letter-spacing:2px;padding:16px 0 4px">НОВАЯ ЧАСТЬ ФРАНШИЗЫ</td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
  <tr><td align="center" style="padding:24px 0">
    <a href="${SITE_URL}/my?utm_source=email&utm_medium=notification&utm_campaign=franchise" style="display:inline-block;background:#ffb020;color:#050506;font-weight:700;font-size:14px;text-decoration:none;padding:10px 24px;border-radius:999px">Открыть мой список</a>
  </td></tr>
  <tr><td style="color:#5c5c66;font-size:12px;padding-top:8px;border-top:1px solid #26262e">
    Письмо пришло, потому что у тайтла из вашего списка «посмотрел» вышло продолжение.
    <a href="${unsub}" style="color:#9a9aa6">Отписаться</a>
  </td></tr>
</table>
</td></tr></table></body></html>`;

  return sendEmail({ to: email, subject, html, unsubscribeUrl: unsub });
}
