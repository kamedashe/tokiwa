/**
 * AniList нужен ровно за одним: у него есть настоящие широкие баннеры
 * (~1900×400). У Jikan баннера нет вовсе, а постер 425×600 — растягивать его
 * на всю ширину героя нельзя, каша получается.
 *
 * Заодно берём обложку в extraLarge: она заметно чётче jikan'овской.
 */

const ENDPOINT = "https://graphql.anilist.co";

/** Лимит AniList — 90 запросов в минуту, держим дистанцию. */
const MIN_INTERVAL_MS = 750;
let lastRequestAt = 0;

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

const QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      id
      bannerImage
      coverImage { extraLarge }
    }
  }
`;

/**
 * Пачкой — до 50 тайтлов за запрос. Поштучно апгрейд обложек всего каталога
 * растянулся бы на месяцы: лимит AniList считает запросы, а не тайтлы в них.
 */
const BATCH_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(idMal_in: $ids, type: ANIME) {
        id
        idMal
        bannerImage
        coverImage { extraLarge }
      }
    }
  }
`;

const RELATIONS_QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      relations {
        edges {
          relationType
          node { idMal type }
        }
      }
    }
  }
`;

/** Те же типы связей, что и у Jikan, но в терминах AniList. */
const WANTED = new Set([
  "SEQUEL",
  "PREQUEL",
  "SIDE_STORY",
  "PARENT",
  "ALTERNATIVE",
  "SUMMARY",
]);

/**
 * Связанные части через AniList — запасной путь, когда Jikan отдаёт 504.
 * Его ручка /relations регулярно лежит, а AniList работает стабильно.
 */
export async function fetchRelatedIdsViaAniList(malId: number): Promise<number[]> {
  await throttle();

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: RELATIONS_QUERY, variables: { idMal: malId } }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  const data = (await res.json()) as {
    data?: {
      Media?: {
        relations?: { edges?: { relationType: string; node?: { idMal: number | null; type: string } }[] };
      };
    };
  };

  const edges = data?.data?.Media?.relations?.edges ?? [];
  const ids = new Set<number>();

  for (const edge of edges) {
    if (!WANTED.has(edge.relationType)) continue;
    if (edge.node?.type !== "ANIME") continue;
    if (edge.node.idMal) ids.add(edge.node.idMal);
  }

  return [...ids];
}

export interface AniListArt {
  anilistId: number | null;
  bannerUrl: string | null;
  coverUrl: string | null;
}

export async function fetchArt(malId: number, attempt = 1): Promise<AniListArt | null> {
  const MAX_ATTEMPTS = 3;
  await throttle();

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { idMal: malId } }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    if (attempt >= MAX_ATTEMPTS) return null;
    await new Promise((r) => setTimeout(r, attempt * 1500));
    return fetchArt(malId, attempt + 1);
  }

  // 429 — упёрлись в лимит, ждём и повторяем.
  if (res.status === 429 && attempt < MAX_ATTEMPTS) {
    const retryAfter = Number(res.headers.get("retry-after") ?? 5);
    await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
    return fetchArt(malId, attempt + 1);
  }

  if (!res.ok) return null;

  const data = (await res.json()) as {
    data?: { Media?: { id: number; bannerImage: string | null; coverImage?: { extraLarge: string | null } } };
  };

  const media = data?.data?.Media;
  if (!media) return null;

  return {
    anilistId: media.id ?? null,
    bannerUrl: media.bannerImage ?? null,
    coverUrl: media.coverImage?.extraLarge ?? null,
  };
}

/**
 * То же, но пачкой: ключ результата — malId. Тайтлы, которых AniList не знает,
 * в ответе просто отсутствуют. Больше 50 за раз их API не отдаёт.
 */
export async function fetchArtBatch(
  malIds: number[],
  attempt = 1,
): Promise<Map<number, AniListArt>> {
  const MAX_ATTEMPTS = 3;
  const result = new Map<number, AniListArt>();
  if (malIds.length === 0) return result;

  await throttle();

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: BATCH_QUERY, variables: { ids: malIds.slice(0, 50) } }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    if (attempt >= MAX_ATTEMPTS) return result;
    await new Promise((r) => setTimeout(r, attempt * 1500));
    return fetchArtBatch(malIds, attempt + 1);
  }

  if (res.status === 429 && attempt < MAX_ATTEMPTS) {
    const retryAfter = Number(res.headers.get("retry-after") ?? 5);
    await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
    return fetchArtBatch(malIds, attempt + 1);
  }

  if (!res.ok) return result;

  const data = (await res.json()) as {
    data?: {
      Page?: {
        media?: {
          id: number;
          idMal: number | null;
          bannerImage: string | null;
          coverImage?: { extraLarge: string | null };
        }[];
      };
    };
  };

  for (const m of data?.data?.Page?.media ?? []) {
    if (!m.idMal) continue;
    result.set(m.idMal, {
      anilistId: m.id ?? null,
      bannerUrl: m.bannerImage ?? null,
      coverUrl: m.coverImage?.extraLarge ?? null,
    });
  }

  return result;
}
