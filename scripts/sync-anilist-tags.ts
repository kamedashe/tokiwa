/**
 * Тянет метки AniList с рангами — то, из чего считается вектор тона.
 *
 *   npm run db:anitags              весь каталог, с места остановки
 *   npm run db:anitags -- --limit 200
 *
 * Метки Shikimori (модель Tag) для тона оказались слишком грубыми: их 80 на
 * весь каталог и по три на тайтл, различных наборов выходит 5459 на 15583
 * тайтла, а 39% тайтлов сидят в группах по десять и больше. У AniList меток
 * сотни и по тринадцать на тайтл — на пробе в 500 тайтлов различных наборов
 * оказалось 492, то есть почти у каждого свой.
 *
 * Прогон помечает каждый тайтл в aniTagsSyncedAt, поэтому обрыв не страшен:
 * повторный запуск продолжит с места остановки.
 */
import { prisma } from "../src/lib/prisma";

const ENDPOINT = "https://graphql.anilist.co";

/** Потолок страницы AniList. */
const BATCH = 50;

/**
 * AniList заявляет 90 запросов в минуту, но недавно API вовсе отключали
 * из-за нагрузки, так что держим вдвое ниже заявленного.
 */
const PAUSE_MS = 1500;

/**
 * Метки с рангом ниже полусотни — это единичные голоса, часто мимо. На
 * «Фрирен» ниже этой черты начинается Rotoscoping и прочая случайность.
 */
const MIN_RANK = 50;

const QUERY = `query ($ids: [Int]) {
  Page(perPage: ${BATCH}) {
    media(idMal_in: $ids, type: ANIME) {
      idMal
      tags { id name category rank isAdult isMediaSpoiler isGeneralSpoiler }
    }
  }
}`;

type AniTag = {
  id: number;
  name: string;
  category: string | null;
  rank: number;
  isAdult: boolean;
  isMediaSpoiler: boolean;
  isGeneralSpoiler: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(malIds: number[]): Promise<{ idMal: number; tags: AniTag[] }[]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { ids: malIds } }),
    });

    if (res.ok) {
      const json = (await res.json()) as { data?: { Page: { media: { idMal: number; tags: AniTag[] }[] } }; errors?: unknown };
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 300));
      return json.data?.Page.media ?? [];
    }

    if (attempt >= 5) throw new Error(`AniList ${res.status} после ${attempt} попыток`);
    // При 429 сервер сам говорит, сколько ждать.
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 5000 * (attempt + 1));
  }
}

async function main() {
  const limitAt = process.argv.indexOf("--limit");
  const limit = limitAt > -1 ? Number(process.argv[limitAt + 1]) : undefined;

  const titles = await prisma.title.findMany({
    where: { malId: { not: null }, aniTagsSyncedAt: null },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, malId: true },
  });

  const done = await prisma.title.count({ where: { aniTagsSyncedAt: { not: null } } });
  console.log(`уже обойдено: ${done}, осталось: ${titles.length}`);
  if (!titles.length) return console.log("всё обойдено");

  const started = Date.now();
  let seen = 0;
  let links = 0;
  let missing = 0;

  for (let i = 0; i < titles.length; i += BATCH) {
    const chunk = titles.slice(i, i + BATCH);
    const byMal = new Map(chunk.map((c) => [c.malId!, c.id]));
    const media = await fetchBatch(chunk.map((c) => c.malId!));

    // Справочник меток пополняется по ходу: заранее его не выкачать, у
    // AniList нет ручки «отдай все метки разом».
    const tagRows = new Map<number, AniTag>();
    const pairs: { titleId: number; tagId: number; rank: number }[] = [];

    for (const m of media) {
      const titleId = byMal.get(m.idMal);
      if (!titleId) continue;
      for (const t of m.tags) {
        // Спойлерные метки выкидываем: они и в интерфейсе скрыты, и портят
        // выдачу, подсказывая то, чего человек знать не хочет.
        if (t.isMediaSpoiler || t.isGeneralSpoiler) continue;
        if (t.rank < MIN_RANK) continue;
        tagRows.set(t.id, t);
        pairs.push({ titleId, tagId: t.id, rank: t.rank });
      }
    }
    missing += chunk.length - media.length;

    if (tagRows.size) {
      const rows = [...tagRows.values()];
      await prisma.$executeRaw`
        INSERT INTO "AniTag" (id, name, category, "isAdult")
        SELECT * FROM unnest(
          ${rows.map((t) => t.id)}::int[],
          ${rows.map((t) => t.name)}::text[],
          ${rows.map((t) => t.category)}::text[],
          ${rows.map((t) => t.isAdult)}::boolean[])
        ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name, category = EXCLUDED.category, "isAdult" = EXCLUDED."isAdult"`;
    }

    const ids = chunk.map((c) => c.id);
    // Связи перекладываем целиком: снятая на AniList метка иначе осталась бы
    // висеть у нас навсегда.
    await prisma.$executeRaw`DELETE FROM "TitleAniTag" WHERE "titleId" = ANY(${ids}::int[])`;
    if (pairs.length) {
      await prisma.$executeRaw`
        INSERT INTO "TitleAniTag" ("titleId", "tagId", rank)
        SELECT * FROM unnest(
          ${pairs.map((p) => p.titleId)}::int[],
          ${pairs.map((p) => p.tagId)}::int[],
          ${pairs.map((p) => p.rank)}::int[])
        ON CONFLICT DO NOTHING`;
    }
    await prisma.$executeRaw`UPDATE "Title" SET "aniTagsSyncedAt" = now() WHERE id = ANY(${ids}::int[])`;

    seen += chunk.length;
    links += pairs.length;
    if (seen % 1000 < BATCH || seen === titles.length) {
      const perSec = seen / ((Date.now() - started) / 1000);
      console.log(
        `  ${seen}/${titles.length}, меток ${links}, не нашлось ${missing}, осталось ~${Math.round((titles.length - seen) / perSec / 60)} мин`,
      );
    }

    await sleep(PAUSE_MS);
  }

  console.log(`\nготово за ${Math.round((Date.now() - started) / 1000)} с`);
  console.log(`словарь меток: ${await prisma.aniTag.count()}`);
  console.log(`связей проставлено: ${links}, тайтлов без ответа AniList: ${missing}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
