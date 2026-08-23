/**
 * Показывает текст, который уходит в модель. Главный инструмент подбора
 * состава: выдача плохая — сначала смотрим, что модель вообще видела.
 *
 *   npx tsx scripts/embed-preview.ts Фрирен
 *   npx tsx scripts/embed-preview.ts --random 3
 */
import { prisma } from "../src/lib/prisma";
import { buildEmbeddingText, cleanSynopsis, EMBEDDING_VERSION } from "../src/lib/embedding-text";

const SELECT = {
  id: true, title: true, titleRu: true, titleJp: true, synopsis: true,
  year: true, format: true, status: true, episodesCount: true,
  genres: { select: { name: true } },
  tags: { select: { name: true, nameRu: true, kind: true } },
} as const;

async function main() {
  const randomAt = process.argv.indexOf("--random");
  const titles =
    randomAt > -1
      ? await prisma.$queryRaw<{ id: number }[]>`
            SELECT id FROM "Title" WHERE synopsis IS NOT NULL
            ORDER BY random() LIMIT ${Number(process.argv[randomAt + 1]) || 3}`
          .then((ids) =>
            prisma.title.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select: SELECT }),
          )
      : await prisma.title.findMany({
          where: {
            OR: [
              { title: { contains: process.argv[2] ?? "", mode: "insensitive" } },
              { titleRu: { contains: process.argv[2] ?? "", mode: "insensitive" } },
            ],
          },
          // NULLS LAST: у неанонсированных ещё нет оценки, и без этого
          // «Фрирен» находит сиквел 2027 года вместо самого сериала.
          orderBy: { score: { sort: "desc", nulls: "last" } },
          take: 1,
          select: SELECT,
        });

  if (!titles.length) {
    console.error("ничего не нашёл");
    process.exit(1);
  }

  for (const t of titles) {
    const text = buildEmbeddingText(t);
    console.log(`\n${"=".repeat(70)}\n${t.titleRu ?? t.title}  [состав ${EMBEDDING_VERSION}]\n${"=".repeat(70)}`);
    console.log(text);
    console.log(`\n— символов: ${text.length}, вырезано чисткой: ${(t.synopsis?.length ?? 0) - cleanSynopsis(t.synopsis).length}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
