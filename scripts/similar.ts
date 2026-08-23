/**
 * Похожие тайтлы по смыслу описания — проверка, что вектора живые.
 *
 *   npx tsx scripts/similar.ts Фрирен
 *   npx tsx scripts/similar.ts "Стальной алхимик" 15
 *   npx tsx scripts/similar.ts "Стальной алхимик" 15 --with-franchise
 *
 * Своя франшиза по умолчанию исключена. Она забивает всю выдачу — у
 * «Стального алхимика» семь из десяти мест занимали его же сиквелы и
 * спецвыпуски, — а на странице тайтла для них и так есть отдельный блок
 * «рядом». Смысловому блоку остаётся то, ради чего он нужен: чужие тайтлы,
 * похожие по сути, а не по названию.
 */
import { prisma } from "../src/lib/prisma";

type Row = { id: number; title: string; titleRu: string | null; year: number | null; format: string | null; distance: number };

async function main() {
  const args = process.argv.slice(2);
  const withFranchise = args.includes("--with-franchise");
  const rest = args.filter((a) => !a.startsWith("--"));
  const query = rest[0];
  const limit = Number(rest[1]) || 10;
  if (!query) {
    console.error('нужно название: npx tsx scripts/similar.ts "Фрирен"');
    process.exit(1);
  }

  const found = await prisma.$queryRaw<{ id: number; title: string; titleRu: string | null; has: boolean }[]>`
    SELECT id, title, "titleRu", ("embedding" IS NOT NULL) AS has
    FROM "Title"
    WHERE title ILIKE ${"%" + query + "%"} OR "titleRu" ILIKE ${"%" + query + "%"}
    ORDER BY score DESC NULLS LAST
    LIMIT 1`;

  if (!found.length) {
    console.error(`не нашёл тайтл по «${query}»`);
    process.exit(1);
  }
  const [source] = found;
  if (!source.has) {
    console.error(`у «${source.title}» ещё нет вектора — запусти npm run embed`);
    process.exit(1);
  }

  // Связь франшизы хранится односторонне, поэтому собираем обе стороны.
  const franchise = withFranchise
    ? []
    : await prisma.$queryRaw<{ id: number }[]>`
        SELECT "B" AS id FROM "_TitleRelations" WHERE "A" = ${source.id}
        UNION
        SELECT "A" AS id FROM "_TitleRelations" WHERE "B" = ${source.id}`;
  const excluded = [source.id, ...franchise.map((r) => r.id)];

  console.log(
    `похожие на: ${source.titleRu ?? source.title}` +
      (franchise.length ? `  (франшиза скрыта: ${franchise.length})` : "") +
      "\n",
  );

  // <=> — косинусное расстояние. Подзапрос отдаёт вектор образца; сам образец
  // и его франшиза исключены списком, иначе он первый с расстоянием 0, а за
  // ним идут его же сиквелы.
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, title, "titleRu", year, format,
           "embedding" <=> (SELECT "embedding" FROM "Title" WHERE id = ${source.id}) AS distance
    FROM "Title"
    WHERE "embedding" IS NOT NULL AND id <> ALL(${excluded}::int[])
    ORDER BY distance
    LIMIT ${limit}`;

  for (const [i, r] of rows.entries()) {
    const name = r.titleRu ?? r.title;
    const facts = [r.format, r.year].filter(Boolean).join(" ");
    console.log(
      `${String(i + 1).padStart(2)}. ${(1 - r.distance).toFixed(3)}  ${name}${facts ? `  (${facts})` : ""}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
