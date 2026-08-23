/**
 * Тянет тематические метки с Shikimori — то, что синк каталога отбрасывал.
 *
 *   npx tsx scripts/sync-tags.ts            весь каталог, с места остановки
 *   npx tsx scripts/sync-tags.ts --limit 200
 *
 * Синк каталога берёт только genres с kind="genre" (shikimori.ts), а theme и
 * demographic выбрасывает. Между тем именно они несут тон: Iyashikei, Gore,
 * Survival, Time Travel, Adult Cast. На пробе в 150 тайтлов это ~2 метки на
 * тайтл сверх того, что уже лежит в базе.
 *
 * Ходим в GraphQL, а не в REST: там метки отдаются пачкой по 50, а поштучный
 * обход 15 тысяч тайтлов на лимите Shikimori занял бы часы.
 *
 * Прогон помечает каждый тайтл в tagsSyncedAt, поэтому обрыв не страшен:
 * повторный запуск продолжит с того места, где остановился.
 */
import { prisma } from "../src/lib/prisma";

const ENDPOINT = "https://shikimori.one/api/graphql";

/** Потолок Shikimori — 50 записей в ответе. */
const BATCH = 50;

/**
 * Три потока Shikimori не выдержал: словил 429 на середине каталога. Два
 * потока с паузой после каждого запроса дают около 30 запросов в минуту —
 * втрое ниже заявленного лимита, и обход всё равно укладывается в четверть часа.
 */
const CONCURRENCY = 2;
const PAUSE_MS = 1200;

type Anime = { id: string; genres: { name: string; kind: string }[] | null };
type GenreDict = { name: string; russian: string | null; kind: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function graphql<T>(query: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "TokiWa" },
      body: JSON.stringify({ query }),
    });

    if (res.ok) {
      const json = (await res.json()) as { data?: T; errors?: unknown };
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 300));
      return json.data as T;
    }

    if (attempt >= 5) throw new Error(`Shikimori ${res.status} после ${attempt} попыток`);
    // При 429 сервер часто сам говорит, сколько ждать; иначе отступаем сами.
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 5000 * (attempt + 1));
  }
}

/**
 * Весь справочник меток — 80 штук — отдаётся одним запросом, вместе с
 * русскими именами. Заводим их разом до обхода: иначе пришлось бы на каждую
 * новую метку ходить в базу посреди прогона и сторожить гонку между потоками.
 */
async function seedTags(): Promise<Map<string, number>> {
  const { genres } = await graphql<{ genres: GenreDict[] }>(
    `query { genres(entryType: Anime) { name russian kind } }`,
  );

  for (const g of genres) {
    await prisma.tag.upsert({
      where: { name: g.name },
      create: { name: g.name, nameRu: g.russian, kind: g.kind },
      update: { nameRu: g.russian, kind: g.kind },
    });
  }

  const rows = await prisma.tag.findMany({ select: { id: true, name: true } });
  console.log(`справочник меток: ${genres.length}, в базе: ${rows.length}`);
  return new Map(rows.map((t) => [t.name, t.id]));
}

async function main() {
  const limitAt = process.argv.indexOf("--limit");
  const limit = limitAt > -1 ? Number(process.argv[limitAt + 1]) : undefined;

  const tagIds = await seedTags();

  // Сначала те, к кому ещё не ходили, — на этом и держится возобновление.
  const titles = await prisma.title.findMany({
    where: { malId: { not: null }, tagsSyncedAt: null },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, malId: true },
  });

  const alreadyDone = await prisma.title.count({ where: { tagsSyncedAt: { not: null } } });
  console.log(`уже обойдено: ${alreadyDone}, осталось: ${titles.length}`);
  if (!titles.length) {
    console.log("всё обойдено");
    return;
  }

  const batches: (typeof titles)[] = [];
  for (let i = 0; i < titles.length; i += BATCH) batches.push(titles.slice(i, i + BATCH));

  const started = Date.now();
  let seen = 0;
  let links = 0;
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
      while (next < batches.length) {
        const chunk = batches[next++];
        const byMal = new Map(chunk.map((c) => [c.malId!, c.id]));

        const { animes } = await graphql<{ animes: Anime[] }>(
          `query { animes(ids: "${chunk.map((c) => c.malId).join(",")}", limit: ${BATCH}) { id genres { name kind } } }`,
        );

        const pairs: { tag: number; title: number }[] = [];
        for (const a of animes) {
          const titleId = byMal.get(Number(a.id));
          if (!titleId) continue;
          for (const g of a.genres ?? []) {
            const tagId = tagIds.get(g.name);
            // Метки вне справочника быть не должно; если появилась — лучше
            // пропустить одну, чем ронять весь обход.
            if (tagId) pairs.push({ tag: tagId, title: titleId });
          }
        }

        const ids = chunk.map((c) => c.id);

        // Связи перекладываем целиком: сначала снимаем старые у этой пачки,
        // потом ставим свежие. Иначе снятая на Shikimori метка осталась бы
        // висеть у нас навсегда.
        await prisma.$executeRaw`DELETE FROM "_TagToTitle" WHERE "B" = ANY(${ids}::int[])`;
        if (pairs.length) {
          await prisma.$executeRaw`
            INSERT INTO "_TagToTitle" ("A", "B")
            SELECT * FROM unnest(${pairs.map((p) => p.tag)}::int[], ${pairs.map((p) => p.title)}::int[])
            ON CONFLICT DO NOTHING`;
        }
        await prisma.$executeRaw`UPDATE "Title" SET "tagsSyncedAt" = now() WHERE id = ANY(${ids}::int[])`;

        seen += chunk.length;
        links += pairs.length;
        if (seen % 1000 < BATCH || seen === titles.length) {
          const perSec = seen / ((Date.now() - started) / 1000);
          console.log(
            `  ${seen}/${titles.length}, меток ${links}, осталось ~${Math.round((titles.length - seen) / perSec / 60)} мин`,
          );
        }

        await sleep(PAUSE_MS);
      }
    }),
  );

  const kinds = await prisma.tag.groupBy({ by: ["kind"], _count: true });
  console.log(`\nготово за ${Math.round((Date.now() - started) / 1000)} с`);
  console.log(`меток в справочнике:`, kinds.map((k) => `${k.kind}: ${k._count}`).join(", "));
  console.log(`связей проставлено за прогон: ${links}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
