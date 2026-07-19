import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { remainingMinutes, totalMinutes } from "@/lib/backlog";
import type { CardTitle } from "@/lib/queries";
import { pickTitle } from "@/lib/title-locale";

const TITLE_FIELDS = {
  id: true,
  slug: true,
  title: true,
  titleRu: true,
  titleJp: true,
  posterUrl: true,
  hue: true,
  score: true,
  format: true,
  episodesCount: true,
  durationMin: true,
  genres: { select: { name: true }, take: 2 },
} as const;

type TitleRecord = {
  id: number;
  slug: string;
  title: string;
  titleRu: string | null;
  titleJp: string | null;
  posterUrl: string | null;
  hue: number;
  score: number | null;
  format: string | null;
  episodesCount: number | null;
  durationMin: number | null;
  genres: { name: string }[];
};

export interface BacklogItem extends CardTitle {
  minutes: number;
  episodesCount: number | null;
  format: string | null;
  /** Длительность известна точно или подставлен фолбэк? */
  estimated: boolean;
}

function toItem(t: TitleRecord, minutes: number, locale: string): BacklogItem {
  const names = pickTitle(t, locale);

  return {
    id: t.id,
    slug: t.slug,
    title: names.title,
    original: names.original,
    posterUrl: t.posterUrl,
    hue: t.hue,
    score: t.score,
    tags: t.genres.map((g) => g.name).join(" · "),
    minutes,
    episodesCount: t.episodesCount,
    format: t.format,
    estimated: t.durationMin === null,
  };
}

export interface BacklogStats {
  plannedMinutes: number;
  plannedCount: number;
  watchingMinutes: number;
  watchingCount: number;
  completedMinutes: number;
  completedCount: number;
}

/** Сводка по времени: сколько уже потрачено и сколько ещё предстоит. */
export async function getBacklogStats(): Promise<BacklogStats | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: session.user.id, status: { in: ["planned", "watching", "completed"] } },
    select: { status: true, progress: true, title: { select: TITLE_FIELDS } },
  });

  const stats: BacklogStats = {
    plannedMinutes: 0,
    plannedCount: 0,
    watchingMinutes: 0,
    watchingCount: 0,
    completedMinutes: 0,
    completedCount: 0,
  };

  for (const e of entries) {
    if (e.status === "planned") {
      stats.plannedMinutes += totalMinutes(e.title);
      stats.plannedCount++;
    } else if (e.status === "watching") {
      stats.watchingMinutes += remainingMinutes(e.title, e.progress);
      stats.watchingCount++;
    } else {
      stats.completedMinutes += totalMinutes(e.title);
      stats.completedCount++;
    }
  }

  return stats;
}

/**
 * Что из списка реально закрыть за отведённое время.
 *
 * «Смотрю» идёт вперёд «запланировано»: логичнее сначала предложить закрыть
 * начатое. Внутри группы — по оценке.
 */
export async function getFitting(locale: string, budget: number): Promise<{
  fits: BacklogItem[];
  tooLong: BacklogItem[];
}> {
  const session = await auth();
  if (!session?.user?.id) return { fits: [], tooLong: [] };

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: session.user.id, status: { in: ["planned", "watching"] } },
    select: { status: true, progress: true, title: { select: TITLE_FIELDS } },
  });

  const items = entries
    .map((e) => ({
      item: toItem(
        e.title,
        e.status === "watching"
          ? remainingMinutes(e.title, e.progress)
          : totalMinutes(e.title),
        locale,
      ),
      watching: e.status === "watching",
    }))
    // Досмотренное до конца, но не отмеченное — предлагать бессмысленно.
    .filter((x) => x.item.minutes > 0);

  items.sort((a, b) => {
    if (a.watching !== b.watching) return a.watching ? -1 : 1;
    return (b.item.score ?? 0) - (a.item.score ?? 0);
  });

  return {
    fits: items.filter((x) => x.item.minutes <= budget).map((x) => x.item),
    tooLong: items
      .filter((x) => x.item.minutes > budget)
      .sort((a, b) => a.item.minutes - b.item.minutes)
      .slice(0, 6)
      .map((x) => x.item),
  };
}
