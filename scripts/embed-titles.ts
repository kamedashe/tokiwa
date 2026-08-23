/**
 * Считает вектора описаний для всего каталога и кладёт их в Title.embedding.
 *
 *   npx tsx scripts/embed-titles.ts            только изменившиеся
 *   npx tsx scripts/embed-titles.ts --force    весь каталог заново
 *   npx tsx scripts/embed-titles.ts --limit 50 прогон на пробу
 *
 * Ключевое здесь — хеш. Прогон считает текст для каждого тайтла заново и
 * сравнивает с тем, что уже лежит в базе; в модель уходят только расхождения.
 * Поэтому после синка перевекторизуются полсотни новых тайтлов за секунды,
 * а полный перегон случается только когда мы сами поменяли состав эмбеддинга
 * и подняли EMBEDDING_VERSION.
 */
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { buildEmbeddingText, EMBEDDING_VERSION } from "../src/lib/embedding-text";
import { embedTexts, usedTokens } from "../src/lib/voyage";

/** Строк в одном UPDATE. Вектор — это ~10 КБ текста, пачками крупнее запрос пухнет. */
const WRITE_CHUNK = 200;

function hashOf(text: string): string {
  const sha = createHash("sha256").update(`${EMBEDDING_VERSION}\n${text}`).digest("hex").slice(0, 32);
  // Версия хранится прямо в хеше, а не только участвует в нём: так по базе
  // видно, какой состав в ней лежит. Константа в коде описывает код, а
  // вектора остаются от прошлого прогона — перепутать эти две вещи легко.
  return `${EMBEDDING_VERSION}:${sha}`;
}

/**
 * pgvector принимает вектор в виде '[0.1,0.2,...]'. Шесть знаков после
 * запятой урезают запрос вдвое, а на косинусе при 1024 измерениях разница
 * порядка 1e-6 — она тонет в самой модели.
 */
function toVectorLiteral(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(",")}]`;
}

async function main() {
  const force = process.argv.includes("--force");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : undefined;

  console.log(`состав эмбеддинга: ${EMBEDDING_VERSION}${force ? ", режим --force" : ""}`);

  const titles = await prisma.title.findMany({
    take: limit,
    orderBy: { id: "asc" },
    select: {
      id: true, title: true, titleRu: true, titleJp: true, synopsis: true,
      year: true, format: true, status: true, episodesCount: true,
      genres: { select: { name: true } },
      tags: { select: { name: true, nameRu: true, kind: true } },
    },
  });

  // Что уже посчитано. Колонки embedding в клиенте Prisma нет (Unsupported),
  // поэтому её наличие проверяем сырым запросом.
  const stored = await prisma.$queryRaw<{ id: number; hash: string | null; has: boolean }[]>`
    SELECT id, "embeddingHash" AS hash, ("embedding" IS NOT NULL) AS has FROM "Title"`;
  const known = new Map(stored.map((r) => [r.id, r]));

  const pending: { id: number; text: string; hash: string }[] = [];
  for (const t of titles) {
    const text = buildEmbeddingText(t);
    if (!text.trim()) continue;
    const hash = hashOf(text);
    const prev = known.get(t.id);
    if (!force && prev?.has && prev.hash === hash) continue;
    pending.push({ id: t.id, text, hash });
  }

  console.log(`в каталоге: ${titles.length}, к пересчёту: ${pending.length}`);
  if (!pending.length) {
    console.log("всё уже посчитано");
    return;
  }

  const started = Date.now();
  const vectors = await embedTexts(
    pending.map((p) => p.text),
    "document",
    (done, total) => {
      if (done % 1024 === 0 || done === total) {
        console.log(`  векторизовано ${done}/${total}`);
      }
    },
  );

  console.log(`записываю в базу...`);
  for (let i = 0; i < pending.length; i += WRITE_CHUNK) {
    const chunk = pending.slice(i, i + WRITE_CHUNK);
    const ids = chunk.map((c) => c.id);
    const embs = chunk.map((_, j) => toVectorLiteral(vectors[i + j]));
    const hashes = chunk.map((c) => c.hash);

    // Один UPDATE на пачку вместо запроса на строку: до базы через океан
    // ~100 мс, и 11 тысяч отдельных запросов заняли бы двадцать минут.
    await prisma.$executeRaw`
      UPDATE "Title" AS t
      SET "embedding" = v.emb::vector,
          "embeddingHash" = v.hash,
          "embeddedAt" = now()
      FROM (
        SELECT unnest(${ids}::int[]) AS id,
               unnest(${embs}::text[]) AS emb,
               unnest(${hashes}::text[]) AS hash
      ) AS v
      WHERE t.id = v.id`;
    console.log(`  записано ${Math.min(i + WRITE_CHUNK, pending.length)}/${pending.length}`);
  }

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) FROM "Title" WHERE "embedding" IS NOT NULL`;

  console.log(`\nготово за ${Math.round((Date.now() - started) / 1000)} с`);
  console.log(`токенов потрачено: ${usedTokens().toLocaleString("ru")} (из 200 млн бесплатных)`);
  console.log(`тайтлов с вектором: ${count} из ${await prisma.title.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
