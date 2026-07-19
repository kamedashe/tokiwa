import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { routing } from "@/i18n/routing";
import { listSeasons } from "@/lib/queries";
import { SITE_URL, localeAlternates } from "@/lib/seo";

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [titles, genres, seasons] = await Promise.all([
    prisma.title.findMany({ select: { slug: true, updatedAt: true } }),
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

  for (const t of titles) {
    entries.push(
      ...entriesFor(`/anime/${t.slug}`, {
        lastModified: t.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      }),
    );
  }

  return entries;
}
