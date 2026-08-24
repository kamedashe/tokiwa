/**
 * Что люди спрашивали у смыслового поиска.
 *
 *   npm run queries          последние 40
 *   npm run queries -- 100   больше
 *   npm run queries -- zero  только те, где ничего не нашлось
 *
 * Пустая выдача — самое ценное здесь: это либо дыра в каталоге, либо
 * формулировка, которую поиск не понял.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const onlyZero = args.includes("zero");
  const limit = Number(args.find((a) => /^\d+$/.test(a))) || 40;

  const rows = await prisma.searchQuery.findMany({
    where: onlyZero ? { results: 0 } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const total = await prisma.searchQuery.count();
  const zero = await prisma.searchQuery.count({ where: { results: 0 } });
  console.log(`всего запросов: ${total}, без единого результата: ${zero}\n`);

  for (const r of rows) {
    const when = r.createdAt.toISOString().slice(5, 16).replace("T", " ");
    const found = r.results === 0 ? "пусто" : `${r.results}`;
    console.log(`${when}  [${r.locale}] ${String(found).padStart(5)}  «${r.text}»`);
    if (r.matched.length) console.log(`${" ".repeat(20)}условия: ${r.matched.join("; ")}`);
  }

  if (!rows.length) console.log("пока ничего не спрашивали");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
