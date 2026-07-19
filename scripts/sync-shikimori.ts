/**
 * Наполняет каталог из Shikimori по популярности — быстрее и надёжнее Jikan
 * на точечных запросах, поэтому основной источник для роста базы, а не
 * только резерв на время импорта.
 *
 *   npx tsx scripts/sync-shikimori.ts [страниц] [с_какой_страницы]
 */
import { prisma } from "../src/lib/prisma";
import { syncCatalogFromShikimori, markHomepagePicks } from "../src/lib/sync";

async function main() {
  const pages = Number(process.argv[2]) || 4;
  const startPage = Number(process.argv[3]) || 1;

  const before = await prisma.title.count();
  console.log(`было тайтлов: ${before}`);
  console.log(`страницы: ${startPage}–${startPage + pages - 1} (по 50 тайтлов)`);

  const r = await syncCatalogFromShikimori({
    pages,
    startPage,
    onProgress: (m) => console.log(m),
  });

  await markHomepagePicks();

  console.log(`проверено: ${r.checked}`);
  console.log(`добавлено: ${r.added}`);
  console.log(`стало тайтлов: ${await prisma.title.count()}`);
  console.log(`для продолжения: npx tsx scripts/sync-shikimori.ts ${pages} ${r.lastPage + 1}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
