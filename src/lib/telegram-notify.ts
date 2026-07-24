import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { sendTelegramMessage, telegramEnabled } from "@/lib/telegram";

/** Telegram размечает HTML — названия тайтлов приходят извне, экранируем. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Шлёт «вышли новые серии» всем, кто привязал Telegram. Запускается после
 * обновления онгоингов теми же кронами.
 *
 * Антидубль — notifiedEpisode на записи списка: уведомляем только когда
 * вышедших серий стало больше и чем прогресс, и чем прошлое уведомление.
 * Prisma не умеет сравнивать колонку с колонкой, поэтому фильтр в коде —
 * привязанных пользователей мало, объём копеечный.
 */
export async function notifyNewEpisodes({ budgetMs = 10_000 }: { budgetMs?: number } = {}) {
  if (!telegramEnabled()) return { sent: 0, skipped: "disabled" as const };

  const deadline = Date.now() + budgetMs;

  const links = await prisma.telegramLink.findMany({
    where: { chatId: { not: null } },
    select: { userId: true, chatId: true },
  });

  let sent = 0;

  for (const link of links) {
    if (Date.now() > deadline) break;

    const entries = await prisma.watchlistEntry.findMany({
      where: {
        userId: link.userId,
        status: "watching",
        title: { episodesAired: { not: null } },
      },
      select: {
        id: true,
        progress: true,
        notifiedEpisode: true,
        title: { select: { slug: true, title: true, titleRu: true, episodesAired: true } },
      },
    });

    const fresh = entries.filter((e) => {
      const aired = e.title.episodesAired!;
      return aired > e.progress && aired > e.notifiedEpisode;
    });

    if (fresh.length === 0) continue;

    const lines = fresh.map((e) => {
      const name = escapeHtml(e.title.titleRu ?? e.title.title);
      const aired = e.title.episodesAired!;
      return `• <a href="${SITE_URL}/anime/${e.title.slug}">${name}</a> — серия ${aired} (вы на ${e.progress})`;
    });

    const ok = await sendTelegramMessage(
      link.chatId!,
      `🔔 <b>Вышли новые серии</b>\n\n${lines.join("\n")}`,
    );

    if (ok) {
      sent++;
      // Отметки — только после успешной отправки, иначе уведомление потеряется.
      await Promise.all(
        fresh.map((e) =>
          prisma.watchlistEntry.update({
            where: { id: e.id },
            data: { notifiedEpisode: e.title.episodesAired! },
          }),
        ),
      );
    }
  }

  return { sent };
}
