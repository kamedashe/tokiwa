/**
 * Поиск по двум векторам.
 *
 * У тайтла два вектора: про что история (название, факты, описание) и какая
 * она (жанры и темы). Запрос — один вектор, он сравнивается с обоими, а
 * результаты смешиваются с весом. Вес и есть та ручка, ради которой всё
 * затевалось: «что-нибудь тихое» тянет к тону, «детектив расследует убийства
 * в городке» — к сюжету, и одним вектором обслужить оба запроса нельзя.
 *
 * Индекса здесь нет намеренно. hnsw умеет упорядочить по одной метрике, а не
 * по сумме двух, так что смешанный порядок он использовать не может в
 * принципе. На 15 тысячах тайтлов честный перебор укладывается в десятки
 * миллисекунд и в отличие от hnsw ничего не приближает.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { toVectorLiteral, VECTOR_SQL_TYPE } from "./vector";

/**
 * Сколько в итоговой близости от тона. 0 — только сюжет, 1 — только тон.
 *
 * Значение выбрано на глаз: разметки, с которой можно свериться, не
 * существует. Но выбирать стало из чего — пока тон считался по меткам
 * Shikimori, больше четверти его убивало выдачу, потому что различных
 * текстов тона было всего 5459 на 15583 тайтла и внутри группы тон не
 * различал ничего. С метками AniList по-русски различных текстов 10752, и
 * вес 0.5 работает уже лучше 0.3: на «что-нибудь тихое и уютное» он поднимает
 * «Лагерь на свежем воздухе», «Комнатный поход» и «Деревенскую глубинку», а
 * «детектив расследует убийства в городке» при этом остаётся детективами.
 * Выше 0.7 всё-таки начинает уводить в сторону.
 *
 * Посмотреть, как вес двигает выдачу: npm run sweep
 */
export const TONE_WEIGHT = Number(process.env.TONE_WEIGHT ?? "0.4");

export type Hit = {
  id: number;
  title: string;
  titleRu: string | null;
  year: number | null;
  format: string | null;
  synopsis: string | null;
  distance: number;
  distancePlot: number;
  distanceTone: number | null;
};

/**
 * Ищет тайтлы по вектору запроса.
 *
 * Расстояния считаются один раз в CTE, а не по разу на каждое упоминание:
 * иначе Postgres пересчитывает их по пять раз на строку, и поиск из
 * восьмидесяти миллисекунд превращается в пятьсот.
 *
 * Отдельная история — сорок четыре тайтла, у которых нет ни одной метки, а
 * значит и вектора тона. Сначала им подставлялось расстояние по сюжету, и это
 * оказалось грубой ошибкой: расстояние по тону в среднем заметно больше, чем
 * по сюжету (тон — короткий список слов, он далёк от любого запроса), поэтому
 * подстановка не уравнивала их с остальными, а освобождала от слагаемого,
 * которое всем прочим портит балл. Эти сорок четыре тайтла занимали по два
 * места в первой пятёрке. Теперь им достаётся среднее расстояние по тону для
 * этого же запроса — то есть ни преимущества, ни штрафа.
 */
export async function searchByVector(
  vector: number[],
  limit: number,
  weight: number = TONE_WEIGHT,
): Promise<Hit[]> {
  const literal = toVectorLiteral(vector);
  const q = Prisma.sql`${literal}::${Prisma.raw(VECTOR_SQL_TYPE)}`;

  return prisma.$queryRaw<Hit[]>`
    WITH d AS (
      SELECT id,
             ("embedding" <=> ${q}) AS dp,
             ("embeddingTone" <=> ${q}) AS dt
      FROM "Title"
      WHERE "embedding" IS NOT NULL
    ),
    m AS (SELECT avg(dt) AS avg_dt FROM d WHERE dt IS NOT NULL),
    top AS (
      SELECT d.id, d.dp, d.dt,
             ${1 - weight} * d.dp + ${weight} * COALESCE(d.dt, m.avg_dt) AS distance
      FROM d, m
      ORDER BY distance
      LIMIT ${limit}
    )
    SELECT t.id, t.title, t."titleRu", t.year, t.format, t.synopsis,
           top.distance, top.dp AS "distancePlot", top.dt AS "distanceTone"
    FROM top JOIN "Title" t ON t.id = top.id
    ORDER BY top.distance`;
}

/**
 * Ищет похожие на заданный тайтл: его собственные вектора выступают запросом,
 * каждый против своей колонки. Сам тайтл и его франшизу исключаем — для
 * сиквелов на странице есть отдельный блок «рядом», и без этого вся выдача
 * состояла бы из них.
 */
export async function similarTo(
  titleId: number,
  limit: number,
  excludeIds: number[],
  weight: number = TONE_WEIGHT,
): Promise<Hit[]> {
  const exclude = [titleId, ...excludeIds];

  return prisma.$queryRaw<Hit[]>`
    WITH src AS (
      SELECT "embedding" AS plot, "embeddingTone" AS tone FROM "Title" WHERE id = ${titleId}
    ),
    d AS (
      SELECT t.id,
             (t."embedding" <=> src.plot) AS dp,
             (t."embeddingTone" <=> src.tone) AS dt
      FROM "Title" t, src
      WHERE t."embedding" IS NOT NULL AND t.id <> ALL(${exclude}::int[])
    ),
    m AS (SELECT avg(dt) AS avg_dt FROM d WHERE dt IS NOT NULL),
    top AS (
      SELECT d.id, d.dp, d.dt,
             ${1 - weight} * d.dp + ${weight} * COALESCE(d.dt, m.avg_dt) AS distance
      FROM d, m
      ORDER BY distance
      LIMIT ${limit}
    )
    SELECT t.id, t.title, t."titleRu", t.year, t.format, t.synopsis,
           top.distance, top.dp AS "distancePlot", top.dt AS "distanceTone"
    FROM top JOIN "Title" t ON t.id = top.id
    ORDER BY top.distance`;
}
