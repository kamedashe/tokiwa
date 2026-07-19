import { prisma } from "@/lib/prisma";

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
}

export interface HeroTitle extends CardTitle {
  titleJp: string | null;
  synopsis: string | null;
  bannerUrl: string | null;
  year: number | null;
  format: string | null;
}

export interface Row {
  title: string;
  count: string;
  href: string;
  items: CardTitle[];
}

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  titleRu: true,
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
  posterUrl: string | null;
  hue: number;
  score: number | null;
  genres: { name: string }[];
};

function toCard(t: CardRecord): CardTitle {
  return {
    id: t.id,
    slug: t.slug,
    // Русское название вперёд — сайт русскоязычный.
    title: t.titleRu ?? t.title,
    original: t.titleRu ? t.title : null,
    posterUrl: t.posterUrl,
    hue: t.hue,
    score: t.score,
    tags: t.genres.map((g) => g.name).join(" · "),
  };
}

const SEASON_RU: Record<string, string> = {
  winter: "Зима",
  spring: "Весна",
  summer: "Лето",
  fall: "Осень",
};

export const SEASON_KEYS = ["winter", "spring", "summer", "fall"] as const;

export function seasonLabel(key: string, year: number) {
  return `${SEASON_RU[key] ?? key} ${year}`;
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
      label: seasonLabel(r.season as string, r.year as number),
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
  return { key, label: `${SEASON_RU[key]} ${now.getFullYear()}`, year: now.getFullYear() };
}

/** Плоский список карточек для страниц-сеток (каталог, топ, сезоны). */
export async function listTitles(
  where: Record<string, unknown> = {},
  take = 60,
): Promise<CardTitle[]> {
  const rows = await prisma.title.findMany({
    where,
    orderBy: [{ score: "desc" }, { id: "asc" }],
    take,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

export const SORTS = {
  score: { label: "По оценке", orderBy: [{ score: "desc" }, { id: "asc" }] },
  year: { label: "Новее", orderBy: [{ year: "desc" }, { score: "desc" }] },
  title: { label: "По алфавиту", orderBy: [{ title: "asc" }] },
} as const;

export type SortKey = keyof typeof SORTS;

export function isSortKey(value: string | undefined): value is SortKey {
  return !!value && value in SORTS;
}

export interface SearchParamsInput {
  q?: string;
  genre?: string;
  sort?: SortKey;
  page?: number;
  perPage?: number;
}

/** Каталог: поиск + фильтр по жанру + сортировка + постраничность. */
export async function searchTitles({
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
    items: rows.map(toCard),
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

export async function getHero(): Promise<HeroTitle | null> {
  const t =
    (await prisma.title.findFirst({
      where: { isFeatured: true },
      include: { genres: { select: { name: true }, take: 2 } },
    })) ??
    (await prisma.title.findFirst({
      orderBy: { score: "desc" },
      include: { genres: { select: { name: true }, take: 2 } },
    }));

  if (!t) return null;

  return {
    ...toCard({ ...t, titleRu: t.titleRu }),
    titleJp: t.titleJp,
    synopsis: t.synopsis,
    bannerUrl: t.bannerUrl,
    year: t.year,
    format: t.format,
  };
}

export async function getHomeRows(excludeId?: number): Promise<Row[]> {
  const season = currentSeason();
  const notHero = excludeId ? { id: { not: excludeId } } : {};

  const [trending, seasonal, seasonTotal, topRated] = await Promise.all([
    prisma.title.findMany({
      where: { isTrending: true, ...notHero },
      orderBy: { score: "desc" },
      take: 14,
      select: CARD_SELECT,
    }),
    prisma.title.findMany({
      where: { season: season.key, year: season.year, ...notHero },
      orderBy: { score: "desc" },
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
      title: "Сейчас в тренде",
      count: `№ ${trending.length}`,
      href: "/catalog?sort=trending",
      items: trending.map(toCard),
    },
    {
      title: `Сезон · ${season.label}`,
      count: `${seasonTotal} тайтлов`,
      href: "/seasons",
      items: seasonal.map(toCard),
    },
    {
      // В макете здесь «Продолжить просмотр · ваш список», но аккаунтов пока
      // нет — показываем честную подборку, пока не появится NextAuth.
      title: "Высокий рейтинг",
      count: "топ-100",
      href: "/top",
      items: topRated.map(toCard),
    },
  ];

  return rows.filter((r) => r.items.length > 0);
}
