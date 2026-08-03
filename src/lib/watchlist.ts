"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getViewerId, getActorId } from "@/lib/guest";
import type { CardTitle } from "@/lib/queries";
import { pickTitle } from "@/lib/title-locale";

/** Статус тайтла у текущего посетителя (гостя — тоже). null — не в списке. */
export async function getEntry(titleId: number) {
  const viewerId = await getViewerId();
  if (!viewerId) return null;

  return prisma.watchlistEntry.findUnique({
    where: { userId_titleId: { userId: viewerId, titleId } },
    select: { status: true, progress: true },
  });
}

/**
 * Добавляет тайтл в список или убирает, если он там уже есть.
 * Возвращает новое состояние, чтобы кнопка могла перерисоваться.
 * Регистрации не требует: у гостя список заводится прямо в браузере.
 */
export async function toggleWatchlist(titleId: number) {
  const userId = await getActorId();
  const existing = await prisma.watchlistEntry.findUnique({
    where: { userId_titleId: { userId, titleId } },
  });

  if (existing) {
    await prisma.watchlistEntry.delete({ where: { id: existing.id } });
  } else {
    await prisma.watchlistEntry.create({ data: { userId, titleId, status: "planned" } });
  }

  revalidatePath("/");
  revalidatePath("/my");

  return { ok: true as const, inList: !existing };
}

/** Меняет статус (и заодно добавляет, если тайтла в списке ещё не было). */
export async function setStatus(titleId: number, status: string) {
  const userId = await getActorId();

  await prisma.watchlistEntry.upsert({
    where: { userId_titleId: { userId, titleId } },
    create: { userId, titleId, status },
    update: { status },
  });

  revalidatePath("/");
  revalidatePath("/my");

  return { ok: true as const, status };
}

/** Запоминает, на какой серии остановились. */
export async function setProgress(titleId: number, progress: number) {
  const userId = await getActorId();

  await prisma.watchlistEntry.upsert({
    where: { userId_titleId: { userId, titleId } },
    create: { userId, titleId, status: "watching", progress },
    update: { progress, status: "watching" },
  });

  revalidatePath("/");
  return { ok: true as const };
}

/**
 * Ряд «Продолжить просмотр» из макета — то, что посетитель смотрит сейчас,
 * свежее сверху. Работает и для гостя с кукой; без куки пусто.
 */
export async function getContinueWatching(locale: string, limit = 14): Promise<CardTitle[]> {
  const viewerId = await getViewerId();
  if (!viewerId) return [];

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: viewerId, status: "watching" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      progress: true,
      title: {
        select: {
          ...CARD_FIELDS,
          episodesCount: true,
          status: true,
          episodesAired: true,
          nextEpisodeAt: true,
        },
      },
    },
  });

  const home = await getTranslations("home");
  const time = await getTranslations("time");

  return entries.map((e) => {
    const card = toCard(e.title, locale);

    // Прогресс отдаём карточке — по нему она рисует «+1» и полосу.
    card.progress = e.progress;
    card.episodesCount = e.title.episodesCount;

    // Бейдж «серия N — завтра» только у онгоингов с известной датой.
    if (e.title.status === "releasing" && e.title.nextEpisodeAt) {
      card.note = home("nextEpisodeShort", {
        n: (e.title.episodesAired ?? 0) + 1,
        date: relativeDate(e.title.nextEpisodeAt, locale, time),
      });
    }

    return card;
  });
}

/** «Сегодня»/«завтра» читаются быстрее даты — а дальше уже просто дата. */
function relativeDate(
  date: Date,
  locale: string,
  time: (key: string) => string,
): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);

  if (days <= 0) return time("today");
  if (days === 1) return time("tomorrow");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date);
}

export interface NewEpisodeItem {
  slug: string;
  name: string;
  progress: number;
  aired: number;
  /** Минуты на догон — то самое «сколько времени», ради чего сайт и существует. */
  catchUpMin: number | null;
}

/**
 * «Вышли новые серии» — тайтлы со статусом «смотрю», у которых вышедших серий
 * больше, чем отмечено у пользователя. Главная причина вернуться на сайт.
 */
export async function getNewEpisodes(locale: string): Promise<NewEpisodeItem[]> {
  const viewerId = await getViewerId();
  if (!viewerId) return [];

  const entries = await prisma.watchlistEntry.findMany({
    where: {
      userId: viewerId,
      status: "watching",
      title: { episodesAired: { not: null } },
    },
    select: {
      progress: true,
      title: {
        select: {
          slug: true,
          title: true,
          titleRu: true,
          titleJp: true,
          episodesAired: true,
          durationMin: true,
        },
      },
    },
  });

  return entries
    .filter((e) => (e.title.episodesAired ?? 0) > e.progress)
    .map((e) => {
      const aired = e.title.episodesAired!;
      const behind = aired - e.progress;
      return {
        slug: e.title.slug,
        name: pickTitle(e.title, locale).title,
        progress: e.progress,
        aired,
        catchUpMin: e.title.durationMin ? behind * e.title.durationMin : null,
      };
    })
    .sort((a, b) => b.aired - b.progress - (a.aired - a.progress));
}

export interface PlannedAiringItem {
  titleId: number;
  slug: string;
  name: string;
  aired: number;
}

/**
 * «Начали выходить» — запланированные тайтлы, у которых уже идут серии.
 * Свежие старты первыми: «вышла 1 серия» — самый сильный повод начать.
 */
export async function getPlannedAiring(locale: string): Promise<PlannedAiringItem[]> {
  const viewerId = await getViewerId();
  if (!viewerId) return [];

  const entries = await prisma.watchlistEntry.findMany({
    where: {
      userId: viewerId,
      status: "planned",
      title: { status: "releasing", episodesAired: { gt: 0 } },
    },
    select: {
      title: {
        select: { id: true, slug: true, title: true, titleRu: true, titleJp: true, episodesAired: true },
      },
    },
  });

  return entries
    .map((e) => ({
      titleId: e.title.id,
      slug: e.title.slug,
      name: pickTitle(e.title, locale).title,
      aired: e.title.episodesAired!,
    }))
    .sort((a, b) => a.aired - b.aired);
}

/** Весь список посетителя, сгруппированный по статусу — для страницы /my. */
export async function getMyList(locale: string) {
  const viewerId = await getViewerId();
  if (!viewerId) return null;

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: viewerId },
    orderBy: { updatedAt: "desc" },
    select: {
      status: true,
      progress: true,
      title: { select: { ...CARD_FIELDS, episodesCount: true } },
    },
  });

  const grouped: Record<string, CardTitle[]> = {
    watching: [],
    completed: [],
    planned: [],
    dropped: [],
  };

  for (const e of entries) {
    if (!(e.status in grouped)) continue;

    const card = toCard(e.title, locale);
    // «+1» — только у начатого: в «запланировано» и «просмотрено» этот жест
    // ничего не значит, а кнопка на каждой карточке превратилась бы в шум.
    if (e.status === "watching") {
      card.progress = e.progress;
      card.episodesCount = e.title.episodesCount;
    }
    grouped[e.status].push(card);
  }

  return grouped;
}

const CARD_FIELDS = {
  id: true,
  slug: true,
  title: true,
  titleRu: true,
  titleJp: true,
  posterUrl: true,
  hue: true,
  score: true,
  genres: { select: { name: true }, take: 2 },
} as const;

function toCard(t: {
  id: number;
  slug: string;
  title: string;
  titleRu: string | null;
  titleJp: string | null;
  posterUrl: string | null;
  hue: number;
  score: number | null;
  genres: { name: string }[];
}, locale: string): CardTitle {
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
  };
}
