import { prisma } from "@/lib/prisma";
import { pickTitle } from "@/lib/title-locale";

export interface CardTitle {
  id: number;
  slug: string;
  /** Русское название, если оно есть, иначе оригинальное. */
  title: string;
  /** Оригинальное название — показываем второй строкой, когда есть русское. */
  original: string | null;
  posterUrl: string | null;
  hue: number;
  score: number | null;
  tags: string;
  /** Строка-бейдж под названием («серия 12 — завтра») — есть не у всех рядов. */
  note?: string | null;
}

export interface HeroTitle extends CardTitle {
  titleJp: string | null;
  synopsis: string | null;
  bannerUrl: string | null;
  year: number | null;
  format: string | null;
}

export interface Row {
  /** Ключ в словаре под `home.*` — подпись собирает компонент. */
  key: string;
  /** Сколько всего тайтлов в подборке; null — счётчик не показываем. */
  count: number | null;
  href: string;
  items: CardTitle[];
  /** Только для сезонного ряда: из чего собрать «Лето 2026». */
  season?: { key: string; year: number };
}

const CARD_SELECT = {
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

type CardRecord = {
  id: number;
  slug: string;
  title: string;
  titleRu: string | null;
  titleJp: string | null;
  posterUrl: string | null;
  hue: number;
  score: number | null;
  genres: { name: string }[];
};

function toCard(t: CardRecord, locale: string): CardTitle {
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

export const SEASON_KEYS = ["winter", "spring", "summer", "fall"] as const;

/** «Лето 2026» на языке пользователя. Подписи сезонов лежат в словаре. */
export function seasonLabel(
  t: (key: string) => string,
  key: string,
  year: number,
): string {
  return `${t(key)} ${year}`;
}

export function isSeasonKey(value: string): boolean {
  return (SEASON_KEYS as readonly string[]).includes(value);
}

/** Все сезоны, по которым есть тайтлы — свежие сверху. Для страницы /seasons. */
export async function listSeasons() {
  const rows = await prisma.title.groupBy({
    by: ["year", "season"],
    where: { year: { not: null }, season: { not: null } },
    _count: { _all: true },
  });

  return rows
    .filter((r) => r.year !== null && r.season !== null)
    .map((r) => ({
      year: r.year as number,
      season: r.season as string,
      count: r._count._all,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return SEASON_KEYS.indexOf(b.season as never) - SEASON_KEYS.indexOf(a.season as never);
    });
}

/** Текущий сезон по календарю — так подписи не протухают со временем. */
export function currentSeason(now = new Date()) {
  const month = now.getMonth();
  const key = month < 3 ? "winter" : month < 6 ? "spring" : month < 9 ? "summer" : "fall";
  return { key, year: now.getFullYear() };
}

/**
 * Postgres по умолчанию считает NULL самым большим значением и при сортировке
 * по убыванию ставит его первым — без `nulls: "last"` каталог начинался с
 * неоценённых анонсов вместо лучшего, что у нас есть.
 */
const BY_SCORE = { score: { sort: "desc", nulls: "last" } } as const;

/** Плоский список карточек для страниц-сеток (каталог, топ, сезоны). */
export async function listTitles(
  locale: string,
  where: Record<string, unknown> = {},
  take = 60,
): Promise<CardTitle[]> {
  const rows = await prisma.title.findMany({
    where,
    orderBy: [BY_SCORE, { id: "asc" }],
    take,
    select: CARD_SELECT,
  });
  return rows.map((r) => toCard(r, locale));
}

/** Подписи лежат в словаре под `catalog.byScore` и так далее. */
export const SORTS = {
  score: { orderBy: [BY_SCORE, { id: "asc" }] },
  year: { orderBy: [{ year: "desc" }, BY_SCORE] },
  title: { orderBy: [{ title: "asc" }] },
} as const;

export type SortKey = keyof typeof SORTS;

export function isSortKey(value: string | undefined): value is SortKey {
  return !!value && value in SORTS;
}

export interface SearchParamsInput {
  locale: string;
  q?: string;
  genre?: string;
  sort?: SortKey;
  page?: number;
  perPage?: number;
}

/** Каталог: поиск + фильтр по жанру + сортировка + постраничность. */
export async function searchTitles({
  locale,
  q,
  genre,
  sort = "score",
  page = 1,
  perPage = 36,
}: SearchParamsInput) {
  const where = {
    // mode: "insensitive" обязателен: в PostgreSQL LIKE различает регистр,
    // без него «гинтама» не найдёт «Гинтама».
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { titleRu: { contains: q, mode: "insensitive" as const } },
            { titleJp: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(genre ? { genres: { some: { slug: genre } } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.title.findMany({
      where,
      orderBy: [...SORTS[sort].orderBy],
      skip: (page - 1) * perPage,
      take: perPage,
      select: CARD_SELECT,
    }),
    prisma.title.count({ where }),
  ]);

  return {
    items: rows.map((r) => toCard(r, locale)),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Жанры с количеством тайтлов — для чипсов-фильтров. Пустые не показываем. */
export async function listGenres() {
  const rows = await prisma.genre.findMany({
    orderBy: { name: "asc" },
    select: { name: true, slug: true, _count: { select: { titles: true } } },
  });

  return rows
    .filter((g) => g._count.titles > 0)
    .map((g) => ({ name: g.name, slug: g.slug, count: g._count.titles }));
}

export async function getHero(locale: string): Promise<HeroTitle | null> {
  const t =
    (await prisma.title.findFirst({
      where: { isFeatured: true },
      include: { genres: { select: { name: true }, take: 2 } },
    })) ??
    (await prisma.title.findFirst({
      orderBy: BY_SCORE,
      include: { genres: { select: { name: true }, take: 2 } },
    }));

  if (!t) return null;

  return {
    ...toCard(t, locale),
    titleJp: t.titleJp,
    synopsis: t.synopsis,
    bannerUrl: t.bannerUrl,
    year: t.year,
    format: t.format,
  };
}

export async function getHomeRows(locale: string, excludeId?: number): Promise<Row[]> {
  const season = currentSeason();
  const notHero = excludeId ? { id: { not: excludeId } } : {};

  const [trending, seasonal, seasonTotal, topRated] = await Promise.all([
    prisma.title.findMany({
      where: { isTrending: true, ...notHero },
      orderBy: BY_SCORE,
      take: 14,
      select: CARD_SELECT,
    }),
    prisma.title.findMany({
      where: { season: season.key, year: season.year, ...notHero },
      orderBy: BY_SCORE,
      take: 14,
      select: CARD_SELECT,
    }),
    prisma.title.count({ where: { season: season.key, year: season.year } }),
    prisma.title.findMany({
      where: { score: { not: null }, ...notHero },
      orderBy: { score: "desc" },
      take: 14,
      select: CARD_SELECT,
    }),
  ]);

  const rows: Row[] = [
    {
      key: "trending",
      count: trending.length,
      href: "/catalog",
      items: trending.map((r) => toCard(r, locale)),
    },
    {
      key: "season",
      count: seasonTotal,
      href: "/seasons",
      items: seasonal.map((r) => toCard(r, locale)),
      season,
    },
    {
      key: "highRated",
      count: null,
      href: "/top",
      items: topRated.map((r) => toCard(r, locale)),
    },
  ];

  return rows.filter((r) => r.items.length > 0);
}
