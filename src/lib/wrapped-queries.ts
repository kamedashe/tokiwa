import { prisma } from "@/lib/prisma";
import { getViewerId } from "@/lib/guest";
import { totalMinutes, FALLBACK_DURATION_MIN } from "@/lib/backlog";
import { pickTitle } from "@/lib/title-locale";

export interface WrappedStats {
  /** Просмотрено всего: закрытые тайтлы целиком + прогресс по начатым. */
  watchedMinutes: number;
  episodesWatched: number;
  completedCount: number;
  droppedCount: number;
  /** Доля брошенного от всего начатого, в процентах. 0 — если нечего делить. */
  dropRate: number;
  topGenres: { name: string; count: number }[];
  longest: { name: string; slug: string; minutes: number } | null;
  /** Средний рейтинг закрытых тайтлов — «уровень вкуса». */
  avgScore: number | null;
}

/**
 * Итоги по всему списку — сырьё для страницы «Мои аниме-итоги».
 * Год не выделяем: дат просмотра у нас нет, у большинства список приехал
 * импортом целиком. Честнее считать всё накопленное.
 */
export async function getWrappedStats(locale: string): Promise<WrappedStats | null> {
  const viewerId = await getViewerId();
  if (!viewerId) return null;

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: viewerId },
    select: {
      status: true,
      progress: true,
      title: {
        select: {
          slug: true,
          title: true,
          titleRu: true,
          titleJp: true,
          format: true,
          score: true,
          episodesCount: true,
          episodesAired: true,
          durationMin: true,
          genres: { select: { name: true } },
        },
      },
    },
  });

  let watchedMinutes = 0;
  let episodesWatched = 0;
  let completedCount = 0;
  let droppedCount = 0;
  let watchingCount = 0;

  const genreCounts = new Map<string, number>();
  let longest: WrappedStats["longest"] = null;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const e of entries) {
    const t = e.title;

    if (e.status === "completed") {
      completedCount++;
      const minutes = totalMinutes(t);
      watchedMinutes += minutes;
      episodesWatched += t.format === "Movie" ? 1 : (t.episodesCount ?? 1);

      // Жанры и вкус считаем по закрытому: это то, что реально досмотрели.
      for (const g of t.genres) genreCounts.set(g.name, (genreCounts.get(g.name) ?? 0) + 1);
      if (t.score !== null) {
        scoreSum += t.score;
        scoreCount++;
      }
      if (!longest || minutes > longest.minutes) {
        longest = { name: pickTitle(t, locale).title, slug: t.slug, minutes };
      }
    } else if (e.status === "watching") {
      watchingCount++;
      if (e.progress > 0) {
        watchedMinutes +=
          t.format === "Movie" ? totalMinutes(t) : e.progress * (t.durationMin ?? FALLBACK_DURATION_MIN);
        episodesWatched += t.format === "Movie" ? 1 : e.progress;
      }
    } else if (e.status === "dropped") {
      droppedCount++;
      if (e.progress > 0) {
        watchedMinutes += t.format === "Movie" ? 0 : e.progress * (t.durationMin ?? FALLBACK_DURATION_MIN);
        episodesWatched += t.format === "Movie" ? 0 : e.progress;
      }
    }
  }

  const started = completedCount + droppedCount + watchingCount;

  return {
    watchedMinutes,
    episodesWatched,
    completedCount,
    droppedCount,
    dropRate: started > 0 ? Math.round((droppedCount / started) * 100) : 0,
    topGenres: [...genreCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    longest,
    avgScore: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
  };
}
