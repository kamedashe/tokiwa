import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { routing } from "@/i18n/routing";
import { listSeasons } from "@/lib/queries";
import { SITE_URL, localeAlternates } from "@/lib/seo";

/**
 * Sitemap шардированный: после наполнения каталога единый файл вырос до
 * 24 МБ и упёрся в лимит Vercel на пререндер (19 МБ) — деплой падал целиком.
 *
 * Шард 0 — статика, жанры и сезоны; дальше — тайтлы порциями. Файл лежит
 * во вложенном сегменте, потому что sitemap.ts в корне app/ занимает адрес
 * /sitemap.xml даже с generateSitemaps — а он нужен индексу
 * (см. src/app/sitemap.xml/route.ts): это тот адрес, что подан в консоли
 * поисковиков. Шарды Next раздаёт на /sitemaps/sitemap/{id}.xml.
 */
export const TITLES_PER_SITEMAP = 2000;

export async function generateSitemaps() {
  const count = await prisma.title.count();
  const shards = 1 + Math.ceil(count / TITLES_PER_SITEMAP);
  return Array.from({ length: shards }, (_, id) => ({ id }));
}

/**
 * Каждая языковая версия страницы — отдельная запись с полным набором
 * hreflang-альтернатив (включая саму себя). Это рекомендация Google, а не
 * прихоть: одна запись с alternates на канонической версии тоже работает,
 * но отдельная запись на каждый язык индексируется надёжнее.
 */
function entriesFor(
  path: string,
  extra: Partial<MetadataRoute.Sitemap[number]> = {},
): MetadataRoute.Sitemap {
  const languages = localeAlternates(path);

  return routing.locales.map((locale) => ({
    url: languages[locale],
    alternates: { languages },
    ...extra,
  }));
}

async function staticShard(): Promise<MetadataRoute.Sitemap> {
  const [genres, seasons] = await Promise.all([
    prisma.genre.findMany({ select: { slug: true } }),
    listSeasons(),
  ]);

  const entries: MetadataRoute.Sitemap = [
    ...entriesFor("/", { changeFrequency: "daily", priority: 1 }),
    ...entriesFor("/catalog", { changeFrequency: "daily", priority: 0.8 }),
    ...entriesFor("/top", { changeFrequency: "weekly", priority: 0.7 }),
    ...entriesFor("/seasons", { changeFrequency: "weekly", priority: 0.7 }),
    // /privacy не переведена на самом деле — все языковые версии показывают
    // один и тот же русский текст, поэтому hreflang для неё был бы обманом
    // поисковика. Одна каноническая запись, без alternates.
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  for (const g of genres) {
    entries.push(...entriesFor(`/genre/${g.slug}`, { changeFrequency: "weekly", priority: 0.5 }));
  }

  for (const s of seasons) {
    entries.push(
      ...entriesFor(`/seasons/${s.year}/${s.season}`, {
        changeFrequency: "weekly",
        priority: 0.5,
      }),
    );
  }

  return entries;
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  // В деве id приезжает строкой из URL, а не числом из generateSitemaps —
  // без приведения `"0" === 0` не проходит и арифметика ниже едет.
  const shard = Number(id);
  if (shard === 0) return staticShard();

  // Порядок по id стабилен: тайтл не переезжает между шардами от прогона
  // к прогону, пока его не удалили.
  const titles = await prisma.title.findMany({
    orderBy: { id: "asc" },
    skip: (shard - 1) * TITLES_PER_SITEMAP,
    take: TITLES_PER_SITEMAP,
    select: { slug: true, updatedAt: true },
  });

  return titles.flatMap((t) =>
    entriesFor(`/anime/${t.slug}`, {
      lastModified: t.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }),
  );
}
