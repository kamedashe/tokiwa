/**
 * Считает вектора каталога и кладёт их в Title.
 *
 *   npm run embed                      только изменившиеся
 *   npm run embed -- --force           весь каталог заново
 *   npm run embed -- --limit 50        прогон на пробу
 *   EMBEDDING_VARIANT=t1 npm run embed другой состав
 *
 * Составы бывают одновекторные (v1–v5) и двухвекторные (t1). Во втором случае
 * тайтл описывается двумя текстами — какой он и про что, — и каждый едет в
 * свою колонку; смешиваются они уже на запросе.
 *
 * Ключевое здесь — хеш. Прогон считает тексты заново и сравнивает с тем, что
 * лежит в базе; в модель уходят только расхождения. Поэтому после синка
 * перевекторизуются полсотни новых тайтлов за секунды, а полный перегон
 * случается, только когда мы сами сменили состав, модель или размерность.
 */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  buildEmbeddingText,
  buildTwoTexts,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  IS_TWO_VECTOR,
} from "../src/lib/embedding-text";
import { toVectorLiteral, VECTOR_DIMENSIONS, VECTOR_SQL_TYPE } from "../src/lib/vector";
import { embedTexts, usedTokens } from "../src/lib/voyage";

/** Строк в одном UPDATE. Вектор — это ~5 КБ текста, пачками крупнее запрос пухнет. */
const WRITE_CHUNK = 200;

/**
 * В хеш входит не только текст, но и чем его считали: смени модель или
 * размерность — и без этого хеш не изменится, прогон решит, что всё уже
 * посчитано, а в базе тихо останутся вектора от прошлой модели.
 *
 * Версия хранится в хеше отдельным куском, а не только участвует в нём: так
 * по базе видно, какой состав в ней лежит. Константа в коде описывает код,
 * вектора остаются от прошлого прогона, и перепутать эти две вещи легко.
 */
function hashOf(text: string): string {
  const stamp = `${EMBEDDING_VERSION}|${EMBEDDING_MODEL}|${VECTOR_DIMENSIONS}`;
  const sha = createHash("sha256").update(`${stamp}|${text}`).digest("hex").slice(0, 32);
  return `${EMBEDDING_VERSION}:${sha}`;
}

type Pending = { id: number; hash: string; plot: string; tone: string | null };

async function main() {
  const force = process.argv.includes("--force");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : undefined;

  console.log(
    `состав: ${EMBEDDING_VERSION}` +
      (IS_TWO_VECTOR ? " (два вектора)" : "") +
      `, ${VECTOR_DIMENSIONS} измерений${force ? ", режим --force" : ""}`,
  );

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

  // Что уже посчитано. Колонок с векторами в клиенте Prisma нет (Unsupported),
  // поэтому их наличие проверяем сырым запросом.
  const stored = await prisma.$queryRaw<{ id: number; hash: string | null; has: boolean }[]>`
    SELECT id, "embeddingHash" AS hash, ("embedding" IS NOT NULL) AS has FROM "Title"`;
  const known = new Map(stored.map((r) => [r.id, r]));

  const pending: Pending[] = [];
  for (const t of titles) {
    const { plot, tone } = IS_TWO_VECTOR
      ? buildTwoTexts(t)
      : { plot: buildEmbeddingText(t), tone: "" };
    if (!plot.trim()) continue;

    const hash = hashOf(`${tone}<<>>${plot}`);
    const prev = known.get(t.id);
    if (!force && prev?.has && prev.hash === hash) continue;

    pending.push({ id: t.id, hash, plot, tone: tone.trim() || null });
  }

  console.log(`в каталоге: ${titles.length}, к пересчёту: ${pending.length}`);
  if (!pending.length) {
    console.log("всё уже посчитано");
    return;
  }

  const started = Date.now();
  const report = (label: string) => (done: number, total: number) => {
    if (done % 2048 === 0 || done === total) console.log(`  ${label} ${done}/${total}`);
  };

  const plotVectors = await embedTexts(pending.map((p) => p.plot), "document", report("сюжет"));

  // Тон считаем только тем, у кого он есть: у сорока с лишним тайтлов нет ни
  // одной метки, и слать в модель пустую строку незачем.
  const withTone = pending.map((p, i) => ({ p, i })).filter((x) => x.p.tone);
  const toneVectors = withTone.length
    ? await embedTexts(withTone.map((x) => x.p.tone!), "document", report("тон"))
    : [];
  const toneByIndex = new Map(withTone.map((x, k) => [x.i, toneVectors[k]]));

  console.log("записываю в базу...");
  for (let i = 0; i < pending.length; i += WRITE_CHUNK) {
    const chunk = pending.slice(i, i + WRITE_CHUNK);
    const ids = chunk.map((c) => c.id);
    const plots = chunk.map((_, j) => toVectorLiteral(plotVectors[i + j]));
    // Пустая строка вместо NULL: unnest по text[] с NULL внутри Prisma не
    // передаст, поэтому пустоту разбираем уже в SQL через NULLIF.
    const tones = chunk.map((_, j) => {
      const v = toneByIndex.get(i + j);
      return v ? toVectorLiteral(v) : "";
    });
    const hashes = chunk.map((c) => c.hash);

    // Один UPDATE на пачку вместо запроса на строку: до базы через океан
    // ~100 мс, и 15 тысяч отдельных запросов заняли бы полчаса.
    await prisma.$executeRaw`
      UPDATE "Title" AS t
      SET "embedding" = v.plot::${Prisma.raw(VECTOR_SQL_TYPE)},
          "embeddingTone" = NULLIF(v.tone, '')::${Prisma.raw(VECTOR_SQL_TYPE)},
          "embeddingHash" = v.hash,
          "embeddedAt" = now()
      FROM (
        SELECT unnest(${ids}::int[]) AS id,
               unnest(${plots}::text[]) AS plot,
               unnest(${tones}::text[]) AS tone,
               unnest(${hashes}::text[]) AS hash
      ) AS v
      WHERE t.id = v.id`;
    console.log(`  записано ${Math.min(i + WRITE_CHUNK, pending.length)}/${pending.length}`);
  }

  const [counts] = await prisma.$queryRaw<{ plot: bigint; tone: bigint }[]>`
    SELECT count("embedding") AS plot, count("embeddingTone") AS tone FROM "Title"`;

  console.log(`\nготово за ${Math.round((Date.now() - started) / 1000)} с`);
  console.log(`токенов потрачено: ${usedTokens().toLocaleString("ru")} (из 200 млн бесплатных)`);
  console.log(`векторов сюжета: ${counts.plot}, тона: ${counts.tone}, тайтлов: ${await prisma.title.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
