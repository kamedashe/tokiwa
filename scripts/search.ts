/**
 * Смысловой поиск по каталогу из консоли — то, ради чего всё затевалось.
 *
 *   npx tsx scripts/search.ts "аниме про готовку в другом мире"
 *   npx tsx scripts/search.ts "тихая грустная история про взросление" 20
 *
 * Строка запроса векторизуется как query, а не как document: Voyage
 * подмешивает разную инструкцию, и запрос ищет описание, а не похожий запрос.
 */
import { prisma } from "../src/lib/prisma";
import { cleanSynopsis } from "../src/lib/embedding-text";
import { embedQuery, usedTokens } from "../src/lib/voyage";

type Row = { title: string; titleRu: string | null; year: number | null; format: string | null; synopsis: string | null; distance: number };

async function main() {
  const query = process.argv.slice(2).filter((a) => !/^\d+$/.test(a)).join(" ");
  const limit = Number(process.argv.find((a) => /^\d+$/.test(a))) || 10;
  if (!query) {
    console.error('нужен запрос: npx tsx scripts/search.ts "аниме про готовку в другом мире"');
    process.exit(1);
  }

  // Neon засыпает без нагрузки, и первый запрос будит базу почти на секунду.
  // Без прогрева это время село бы в замер поиска и врало бы в тридцать раз.
  await prisma.$queryRaw`SELECT 1`;

  const started = Date.now();
  const vector = await embedQuery(query);
  const embedded = Date.now();

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT title, "titleRu", year, format, synopsis,
           "embedding" <=> ${`[${vector.map((x) => x.toFixed(6)).join(",")}]`}::vector AS distance
    FROM "Title"
    WHERE "embedding" IS NOT NULL
    ORDER BY distance
    LIMIT ${limit}`;

  console.log(`«${query}»\n`);
  for (const [i, r] of rows.entries()) {
    const name = r.titleRu ?? r.title;
    const facts = [r.format, r.year].filter(Boolean).join(" ");
    console.log(`${String(i + 1).padStart(2)}. ${(1 - r.distance).toFixed(3)}  ${name}${facts ? `  (${facts})` : ""}`);
    // Показываем описание после чистки — то же, что видела модель. Иначе в
    // консоли мелькают вырезанные аннотации и кажется, что чистка не работает.
    const shown = cleanSynopsis(r.synopsis).replace(/\s+/g, " ");
    if (shown) console.log(`     ${shown.slice(0, 110)}…`);
  }

  console.log(
    `\nвектор запроса: ${embedded - started} мс, поиск в базе: ${Date.now() - embedded} мс, токенов: ${usedTokens()}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
