/**
 * Прогоняет фиксированный набор запросов и печатает выдачу компактно.
 *
 *   npx tsx scripts/probe.ts > before.txt    до правки состава
 *   npx tsx scripts/probe.ts > after.txt     после перегона
 *   diff before.txt after.txt
 *
 * Смысл в том, что набор фиксированный. Меняя состав эмбеддинга, легко
 * обмануться: проверяешь на том запросе, ради которого правил, видишь
 * улучшение и не замечаешь, что сломалось четыре других. Одни и те же
 * двенадцать запросов не дают этого сделать.
 *
 * Запросы подобраны так, чтобы бить в разное: тон, сюжет, сеттинг, жанровую
 * смесь и явно сложные случаи, где синопсис молчит о том, что спрашивают.
 */
import { prisma } from "../src/lib/prisma";
import { EMBEDDING_VERSION } from "../src/lib/embedding-text";
import { embedTexts } from "../src/lib/voyage";

const PROBES = [
  // Тон — то, чего в синопсисе почти никогда нет прямым текстом.
  "что-нибудь тихое и уютное, чтобы отдохнуть",
  "грустная история про взросление и потерю",
  "жестокое выживание, где герои умирают",
  "лёгкая комедия без напряжения",
  // Сюжет и сеттинг — тут синопсис должен работать сам.
  "попал в другой мир и стал сильнейшим",
  "детектив расследует убийства в маленьком городе",
  "школьный клуб готовится к соревнованиям",
  "война роботов в далёком космосе",
  // Смеси и косвенные формулировки — самое сложное.
  "аниме про готовку в другом мире",
  "романтика между взрослыми, а не школьниками",
  "главный герой — злодей, и ему сочувствуешь",
  "красивое визуально, но почти без сюжета",
];

const TOP = 5;

type Row = { title: string; titleRu: string | null; year: number | null; distance: number };

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
  console.log(`запросов ${PROBES.length}, топ-${TOP}`);
  console.log();

  for (const [i, probe] of PROBES.entries()) {
    const literal = `[${vectors[i].map((x) => x.toFixed(6)).join(",")}]`;
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT title, "titleRu", year, "embedding" <=> ${literal}::vector AS distance
      FROM "Title"
      WHERE "embedding" IS NOT NULL
      ORDER BY distance
      LIMIT ${TOP}`;

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
