import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { TITLES_PER_SITEMAP } from "../sitemaps/sitemap";

// Число шардов зависит от размера каталога — считаем на каждый запрос.
export const dynamic = "force-dynamic";

/**
 * Индекс шардов sitemap. Живёт на прежнем адресе /sitemap.xml, поданном в
 * консоли поисковиков, — сами шарды Next раздаёт на /sitemap/{id}.xml.
 * Формат sitemapindex стандартный, все поисковики разворачивают его сами.
 */
export async function GET() {
  const count = await prisma.title.count();
  const shards = 1 + Math.ceil(count / TITLES_PER_SITEMAP);

  const items = Array.from(
    { length: shards },
    (_, id) => `  <sitemap><loc>${SITE_URL}/sitemaps/sitemap/${id}.xml</loc></sitemap>`,
  );

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...items,
    `</sitemapindex>`,
  ].join("\n");

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
