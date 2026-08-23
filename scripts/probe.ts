/**
 * Прогоняет постоянный набор запросов (src/lib/probe-queries.ts) и печатает
 * выдачу компактно — чтобы правки поиска можно было сравнивать, а не помнить.
 *
 *   npm run probe > before.txt
 *   # меняем состав, поднимаем версию, npm run embed
 *   npm run probe > after.txt
 *   npm run compare before.txt after.txt
 */
import { prisma } from "../src/lib/prisma";
import { EMBEDDING_VERSION } from "../src/lib/embedding-text";
import { PROBES } from "../src/lib/probe-queries";
import { searchByVector, TONE_WEIGHT } from "../src/lib/semantic-search";
import { embedTexts } from "../src/lib/voyage";

const TOP = 5;

async function main() {
  await prisma.$queryRaw`SELECT 1`;

  const vectors = await embedTexts(PROBES, "query");
  // Какой состав реально лежит в базе, а не объявлен в коде.
  const inDb = await prisma.$queryRaw<{ v: string; c: bigint }[]>`
    SELECT CASE WHEN "embeddingHash" LIKE '%:%'
                THEN split_part("embeddingHash", ':', 1)
                ELSE 'до-версионный' END v,
           count(*) c
    FROM "Title" WHERE "embedding" IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC`;
  const stored = inDb.map((r) => `${r.v}: ${r.c}`).join(", ");
  console.log(`в базе — ${stored}; в коде — ${EMBEDDING_VERSION}`);
  if (!inDb.every((r) => r.v === EMBEDDING_VERSION)) {
    console.log("ВНИМАНИЕ: вектора в базе не от текущего состава — нужен npm run embed");
  }
  console.log(`запросов ${PROBES.length}, топ-${TOP}, вес тона ${TONE_WEIGHT}`);
  console.log();

  for (const [i, probe] of PROBES.entries()) {
    const rows = await searchByVector(vectors[i], TOP);

    console.log(`### ${probe}`);
    for (const r of rows) {
      console.log(`    ${(1 - r.distance).toFixed(3)}  ${r.titleRu ?? r.title}${r.year ? ` (${r.year})` : ""}`);
    }
    console.log();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
