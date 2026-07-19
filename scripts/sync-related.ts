/**
 * Достраивает франшизы: обходит связи тайтлов и подтягивает недостающие части.
 *
 * Прогон инкрементальный — каждый обработанный тайтл помечается
 * `relatedSyncedAt`, поэтому скрипт можно прерывать и запускать снова, он
 * продолжит с места остановки. Внешние API медленные и нестабильные, так что
 * гонять всё разом смысла нет.
 *
 *   npx tsx scripts/sync-related.ts [сколько_тайтлов_проверить] [лимит_новых]
 */
import { prisma } from "../src/lib/prisma";
import { syncRelated, markHomepagePicks } from "../src/lib/sync";

async function main() {
  // Слаг вместо числа означает «добрать вот этот тайтл прямо сейчас»:
  //   npx tsx scripts/sync-related.ts steins-gate
  const first = process.argv[2];
  const slug = first && Number.isNaN(Number(first)) ? first : undefined;

  const seeds = slug ? 1 : Number(process.argv[2]) || 20;
  const limit = Number(process.argv[3]) || 40;

  const before = await prisma.title.count();
  console.log(`было тайтлов: ${before}`);
  if (slug) console.log(`целевой тайтл: ${slug}`);

  const r = await syncRelated({
    seeds,
    limit,
    slug,
    onProgress: (m) => console.log(m),
  });

  await markHomepagePicks();

  console.log(`проверено франшиз: ${r.checked}`);
  console.log(`добавлено тайтлов: ${r.added}`);
  console.log(`стало тайтлов: ${await prisma.title.count()}`);
  console.log(`осталось непроверенных: ${r.left}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
