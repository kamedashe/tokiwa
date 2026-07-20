import { prisma } from "@/lib/prisma";
import {
  fetchAnimeById,
  fetchCurrentSeason,
  fetchRelatedIds,
  fetchTopAnime,
  normalize,
  type JikanAnime,
} from "@/lib/jikan";
import { fetchArt, fetchRelatedIdsViaAniList } from "@/lib/anilist";
import { fetchAnimeDetails, fetchPopularAnimeIds, fetchRussianTitle } from "@/lib/shikimori";
import { hueFrom, slugify } from "@/lib/slug";

/**
 * Кладёт тайтл из Jikan в нашу БД. Ключ — malId, так что повторный вызов
 * обновляет метаданные, а не плодит дубли.
 */
export async function upsertFromJikan(anime: JikanAnime, enrich = true) {
  const base = normalize(anime);

  // Jikan не отдаёт ни широких баннеров, ни русских названий — добираем из
  // AniList и Shikimori. Оба падения не критичны: без них тайтл просто
  // сохранится с тем, что есть.
  const [art, titleRu] = enrich
    ? await Promise.all([
        fetchArt(base.malId).catch(() => null),
        fetchRussianTitle(base.malId).catch(() => null),
      ])
    : [null, null];

  return persistTitle({
    ...base,
    titleRu,
    anilistId: art?.anilistId ?? null,
    // Обложка AniList заметно чётче, но если её нет — остаётся jikan'овская.
    posterUrl: art?.coverUrl ?? base.posterUrl,
    bannerUrl: art?.bannerUrl ?? base.bannerUrl,
  });
}

/** Форма тайтла, из которой можно писать в БД: общая для Jikan и Shikimori. */
interface NormalizedTitle {
  malId: number;
  title: string;
  titleJp: string | null;
  titleRu?: string | null;
  synopsis: string | null;
  posterUrl: string | null;
  bannerUrl: string | null;
  anilistId?: number | null;
  year: number | null;
  season: string | null;
  format: string | null;
  status: string | null;
  score: number | null;
  episodesCount: number | null;
  durationMin: number | null;
  genreNames: string[];
}

/** Собственно запись в БД: жанры, уникальный слаг, upsert по malId. */
async function persistTitle(n: NormalizedTitle) {
  const genres = await Promise.all(
    n.genreNames.map((name) =>
      prisma.genre.upsert({
        where: { name },
        create: { name, slug: slugify(name) },
        update: {},
      }),
    ),
  );

  // Слаг должен быть уникальным: если такой уже занят другим тайтлом,
  // дописываем malId.
  let slug = slugify(n.title);
  const clash = await prisma.title.findUnique({ where: { slug } });
  if (clash && clash.malId !== n.malId) slug = `${slug}-${n.malId}`;

  const data = {
    slug,
    title: n.title,
    titleJp: n.titleJp,
    titleRu: n.titleRu ?? undefined,
    synopsis: n.synopsis,
    posterUrl: n.posterUrl,
    bannerUrl: n.bannerUrl,
    hue: hueFrom(n.title),
    year: n.year,
    season: n.season,
    format: n.format,
    status: n.status,
    score: n.score,
    episodesCount: n.episodesCount,
    durationMin: n.durationMin,
    syncedAt: new Date(),
  };

  return prisma.title.upsert({
    where: { malId: n.malId },
    create: {
      ...data,
      malId: n.malId,
      anilistId: n.anilistId,
      genres: { connect: genres.map((g) => ({ id: g.id })) },
    },
    update: {
      ...data,
      genres: { set: genres.map((g) => ({ id: g.id })) },
    },
  });
}

/**
 * Добирает тайтл из Shikimori. Используется импортом списков: Jikan на
 * точечных запросах уходит в 504 и с ретраями съедает ~20 секунд на тайтл,
 * тогда как Shikimori отвечает примерно за секунду и не подводит.
 *
 * Баннер и обложку получше потом подставит обычный синк через AniList —
 * upsert не затирает уже заполненные поля пустыми.
 */
export async function upsertFromShikimori(malId: number) {
  const details = await fetchAnimeDetails(malId);
  if (!details) return null;

  return persistTitle(details);
}

/**
 * Полный проход: топ по популярности + текущий сезон.
 * Возвращает сколько тайтлов затронули.
 */
export async function syncCatalog({
  pages = 1,
  budgetMs,
}: { pages?: number; budgetMs?: number } = {}) {
  // Прогон обогащает каждый тайтл через AniList и Shikimori, поэтому идёт
  // куда медленнее, чем кажется по числу страниц: без потолка по времени он
  // легко перерастает лимит серверless-ручки и обрывается на полуслове.
  const deadline = budgetMs ? Date.now() + budgetMs : null;
  const seen = new Set<number>();
  let count = 0;

  // Jikan заметно нестабилен (пачками отдаёт 504). Если один источник
  // отвалился — забираем что смогли из остальных, а не роняем весь прогон.
  const sources: [string, () => Promise<JikanAnime[]>][] = [];
  for (let page = 1; page <= pages; page++) {
    sources.push([`top p${page}`, () => fetchTopAnime(25, page)]);
    sources.push([`season p${page}`, () => fetchCurrentSeason(25, page)]);
  }

  for (const [label, load] of sources) {
    if (deadline && Date.now() > deadline) break;

    let batch: JikanAnime[];
    try {
      batch = await load();
    } catch (error) {
      console.warn(`Источник «${label}» недоступен, пропускаем:`, (error as Error).message);
      continue;
    }

    for (const anime of batch) {
      if (deadline && Date.now() > deadline) break;
      if (seen.has(anime.mal_id)) continue;
      seen.add(anime.mal_id);
      await upsertFromJikan(anime);
      count++;
    }
  }

  return count;
}

/**
 * Какие id со страницы у нас ещё не сохранены. Одним запросом на страницу,
 * а не по одному на тайтл: на длинных прогонах полсотни отдельных запросов
 * выедали пул соединений и роняли всё с P2024.
 */
async function unknownIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];

  const rows = await prisma.title.findMany({
    where: { malId: { in: ids } },
    select: { malId: true },
  });

  const known = new Set(rows.map((r) => r.malId));
  return ids.filter((id) => !known.has(id));
}

/**
 * Neon рвёт долгие соединения, а пул Prisma не всегда переживает это молча.
 * Ошибка на одной странице не повод терять часы прогона — ждём и пробуем ещё.
 */
async function withRetry<T>(action: () => Promise<T>, attempts = 4): Promise<T | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (attempt === attempts) {
        console.warn("  ! страница пропущена:", (error as Error).message.split("\n")[0]);
        return null;
      }
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  return null;
}

/**
 * Наполняет каталог напрямую из Shikimori, по популярности.
 *
 * Основной сид (`syncCatalog`) берёт только топ и текущий сезон из Jikan —
 * этого мало, каталог отстаёт от живых списков пользователей на порядок
 * (см. `backfillMissing` в import-actions.ts). Shikimori отдаёт то же самое
 * быстрее и без 504, так что им и наполняем впрок, а не только по запросу
 * во время импорта.
 *
 * `startPage` позволяет продолжить с места, если прошлый прогон прервали —
 * страница пишется в лог, чтобы её можно было передать вручную.
 */
export async function syncCatalogFromShikimori({
  pages = 4,
  startPage = 1,
  onProgress,
}: {
  pages?: number;
  startPage?: number;
  onProgress?: (message: string) => void;
} = {}) {
  let added = 0;
  let checked = 0;

  for (let page = startPage; page < startPage + pages; page++) {
    const ids = await withRetry(() => fetchPopularAnimeIds(page));
    if (ids === null) continue; // страницу не отдали — не конец каталога
    if (ids.length === 0) break; // страницы кончились

    checked += ids.length;

    const fresh = await withRetry(() => unknownIds(ids));
    if (fresh === null) continue;

    for (const malId of fresh) {
      const saved = await withRetry(() => upsertFromShikimori(malId), 2);
      if (saved) {
        added++;
        onProgress?.(`  + ${saved.titleRu ?? saved.title}`);
      }
    }
  }

  return { checked, added, lastPage: startPage + pages - 1 };
}

const SHIKIMORI_CURSOR_KEY = "shikimoriPage";

/**
 * То же самое, но для крона: сама помнит, на какой странице остановилась
 * (курсор в SyncState), и укладывается в бюджет времени, а не в число страниц —
 * ручка на Vercel живёт максимум 60 секунд, а не «столько, сколько нужно».
 *
 * Когда страницы популярности заканчиваются, курсор возвращается к 1 —
 * дальше там всё равно нишевое, а свежие тайтлы поднимаются наверх списка.
 */
export async function syncCatalogFromShikimoriCron({
  budgetMs = 50_000,
  onProgress,
}: {
  budgetMs?: number;
  onProgress?: (message: string) => void;
} = {}) {
  const deadline = Date.now() + budgetMs;

  const cursor = await prisma.syncState.findUnique({ where: { key: SHIKIMORI_CURSOR_KEY } });
  let page = cursor?.value ?? 1;

  let added = 0;
  let checked = 0;
  let pagesDone = 0;

  while (Date.now() < deadline) {
    const ids = await fetchPopularAnimeIds(page);
    if (ids.length === 0) {
      page = 1; // дошли до конца — начинаем следующий круг заново
      break;
    }

    checked += ids.length;

    for (const malId of await unknownIds(ids)) {
      try {
        const saved = await upsertFromShikimori(malId);
        if (saved) {
          added++;
          onProgress?.(`  + ${saved.titleRu ?? saved.title}`);
        }
      } catch {
        // Точечный сбой на одном тайтле не должен рушить весь прогон.
      }

      if (Date.now() > deadline) break;
    }

    page++;
    pagesDone++;
  }

  await prisma.syncState.upsert({
    where: { key: SHIKIMORI_CURSOR_KEY },
    create: { key: SHIKIMORI_CURSOR_KEY, value: page },
    update: { value: page },
  });

  return { checked, added, pagesDone, nextPage: page };
}

/**
 * Достраивает франшизы: у каждого тайтла в базе спрашивает связанные части
 * (сиквелы, приквелы, фильмы, спешлы) и подтягивает недостающие.
 *
 * Без этого в каталоге лежит «Steins;Gate», но нет ни фильма, ни Zero —
 * попадает только то, что оказалось в топе или текущем сезоне.
 *
 * `limit` ограничивает число новых тайтлов за прогон: связи ветвятся, и без
 * потолка обход уходит гулять по половине MAL.
 */
export async function syncRelated({
  seeds = 20,
  limit = 40,
  slug,
  onProgress,
}: {
  /** Сколько тайтлов проверить за прогон. */
  seeds?: number;
  /** Потолок новых тайтлов — связи ветвятся, без него обход не кончится. */
  limit?: number;
  /** Обойти связи конкретного тайтла, не дожидаясь общей очереди. */
  slug?: string;
  onProgress?: (message: string) => void;
} = {}) {
  const known = await prisma.title.findMany({ select: { malId: true } });
  const knownIds = new Set(known.map((t) => t.malId).filter((id): id is number => id !== null));

  // Либо конкретный тайтл, либо те, у которых связи ещё не обходили —
  // тогда прогон возобновляется с места остановки, а не начинает заново.
  const pending = slug
    ? await prisma.title.findMany({
        where: { slug },
        select: { id: true, malId: true, title: true },
      })
    : await prisma.title.findMany({
        where: { relatedSyncedAt: null, malId: { not: null } },
        orderBy: { score: "desc" },
        take: seeds,
        select: { id: true, malId: true, title: true },
      });

  let added = 0;
  let checked = 0;

  for (const seed of pending) {
    if (!seed.malId) continue;
    if (added >= limit) break;

    // Jikan'овская ручка /relations лежит куда чаще остального API — для
    // отдельных тайтлов она отдаёт 504 неделями. AniList выручает.
    let related: number[] = [];
    try {
      related = await fetchRelatedIds(seed.malId);
    } catch {
      related = await fetchRelatedIdsViaAniList(seed.malId);
      if (related.length === 0) continue; // отметку не ставим, вернёмся позже
    }

    checked++;

    for (const malId of related) {
      if (knownIds.has(malId) || added >= limit) continue;

      try {
        const anime = await fetchAnimeById(malId);
        const saved = await upsertFromJikan(anime);
        knownIds.add(malId);
        added++;
        onProgress?.(`  + ${saved.titleRu ?? saved.title}`);
      } catch {
        // Часть id ведёт на удалённые записи — это нормально.
      }
    }

    await prisma.title.update({
      where: { id: seed.id },
      data: { relatedSyncedAt: new Date() },
    });
  }

  const left = await prisma.title.count({ where: { relatedSyncedAt: null } });
  return { checked, added, left };
}

/**
 * Витрина главной: hero — самый высокий балл, дальше подборки.
 * Флаги isFeatured/isTrending ставятся руками в БД и всегда побеждают.
 */
export async function markHomepagePicks() {
  const hasFeatured = await prisma.title.count({ where: { isFeatured: true } });
  if (hasFeatured === 0) {
    const best = await prisma.title.findFirst({
      where: { posterUrl: { not: null } },
      orderBy: { score: "desc" },
    });
    if (best) await prisma.title.update({ where: { id: best.id }, data: { isFeatured: true } });
  }

  const hasTrending = await prisma.title.count({ where: { isTrending: true } });
  if (hasTrending === 0) {
    const top = await prisma.title.findMany({
      orderBy: { score: "desc" },
      take: 12,
      select: { id: true },
    });
    await prisma.title.updateMany({
      where: { id: { in: top.map((t) => t.id) } },
      data: { isTrending: true },
    });
  }
}
