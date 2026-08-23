/**
 * Смысловой поиск по каталогу из консоли.
 *
 *   npm run search -- "аниме про готовку в другом мире"
 *   npm run search -- "тихая грустная история" 20
 *   TONE_WEIGHT=0.6 npm run search -- "что-нибудь уютное"
 *
 * Рядом с общим баллом печатаются оба слагаемых — сюжет и тон. По ним видно,
 * чем именно тайтл попал в выдачу, и это же подсказывает, куда крутить вес.
 *
 * Строка запроса векторизуется как query, а не как document: Voyage
 * подмешивает разную инструкцию, и запрос ищет описание, а не похожий запрос.
 */
import { prisma } from "../src/lib/prisma";
import { cleanSynopsis } from "../src/lib/embedding-text";
import { searchByVector, TONE_WEIGHT } from "../src/lib/semantic-search";
import { embedQuery, usedTokens } from "../src/lib/voyage";

async function main() {
  const args = process.argv.slice(2);
  const query = args.filter((a) => !/^\d+$/.test(a)).join(" ");
  const limit = Number(args.find((a) => /^\d+$/.test(a))) || 10;
  if (!query) {
    console.error('нужен запрос: npm run search -- "аниме про готовку в другом мире"');
    process.exit(1);
  }

  // Neon засыпает без нагрузки, и первый запрос будит базу почти на секунду.
  // Без прогрева это время село бы в замер поиска и врало бы в тридцать раз.
  await prisma.$queryRaw`SELECT 1`;

  const started = Date.now();
  const vector = await embedQuery(query);
  const embedded = Date.now();

  const rows = await searchByVector(vector, limit);

  console.log(`«${query}»   вес тона ${TONE_WEIGHT}\n`);
  for (const [i, r] of rows.entries()) {
    const name = r.titleRu ?? r.title;
    const facts = [r.format, r.year].filter(Boolean).join(" ");
    const tone = r.distanceTone === null ? "  —  " : (1 - r.distanceTone).toFixed(3);
    console.log(
      `${String(i + 1).padStart(2)}. ${(1 - r.distance).toFixed(3)}  ` +
        `[сюжет ${(1 - r.distancePlot).toFixed(3)} · тон ${tone}]  ${name}${facts ? `  (${facts})` : ""}`,
    );
    // Показываем описание после чистки — то же, что видела модель.
    const shown = cleanSynopsis(r.synopsis).replace(/\s+/g, " ");
    if (shown) console.log(`     ${shown.slice(0, 100)}…`);
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
