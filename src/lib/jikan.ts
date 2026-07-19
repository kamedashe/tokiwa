/**
 * Тонкая обёртка над Jikan v4 (публичная обёртка MyAnimeList).
 * Всё, что отсюда приходит, кэшируется в нашей БД — внешний API дёргается
 * только скриптом сидинга и ручкой /api/sync, не на каждый запрос страницы.
 */

const BASE = "https://api.jikan.moe/v4";

/** Jikan разрешает 3 запроса в секунду. Держим дистанцию с запасом. */
const MIN_INTERVAL_MS = 400;
let lastRequestAt = 0;

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  synopsis: string | null;
  type: string | null;
  status: string | null;
  episodes: number | null;
  score: number | null;
  year: number | null;
  season: string | null;
  duration: string | null;
  images: { jpg: { large_image_url: string | null } };
  trailer: { images?: { maximum_image_url?: string | null } } | null;
  genres: { mal_id: number; name: string }[];
}

/**
 * Jikan регулярно отдаёт 429 (лимит) и 5xx (их апстрим к MAL отваливается).
 * И то, и другое лечится повтором с нарастающей паузой.
 */
async function get<T>(path: string, attempt = 1, maxAttempts = 6): Promise<T> {
  const MAX_ATTEMPTS = maxAttempts;
  await throttle();

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) throw error;
    await new Promise((r) => setTimeout(r, attempt * 1500));
    return get<T>(path, attempt + 1, maxAttempts);
  }

  if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
    await new Promise((r) => setTimeout(r, attempt * 1500));
    return get<T>(path, attempt + 1, maxAttempts);
  }

  if (!res.ok) {
    throw new Error(`Jikan ${res.status} ${res.statusText} на ${path}`);
  }

  return (await res.json()) as T;
}

/** Топ по оценке. Параметр filter=bypopularity у Jikan стабильно отваливается
 *  в 504 — не используем. */
export async function fetchTopAnime(limit = 25, page = 1): Promise<JikanAnime[]> {
  const data = await get<{ data: JikanAnime[] }>(`/top/anime?limit=${limit}&page=${page}`);
  return data.data;
}

export async function fetchCurrentSeason(limit = 25, page = 1): Promise<JikanAnime[]> {
  const data = await get<{ data: JikanAnime[] }>(`/seasons/now?limit=${limit}&page=${page}`);
  return data.data;
}

export async function fetchAnimeById(malId: number): Promise<JikanAnime> {
  const data = await get<{ data: JikanAnime }>(`/anime/${malId}`);
  return data.data;
}

/** Типы связей, которые действительно достраивают франшизу. */
const WANTED_RELATIONS = new Set([
  "Sequel",
  "Prequel",
  "Side Story",
  "Parent Story",
  "Alternative Version",
  "Full Story",
  "Summary",
]);

/**
 * Связанные части: сиквелы, приквелы, фильмы, спешлы.
 * Без этого в каталоге оказывается только один сезон из франшизы.
 */
export async function fetchRelatedIds(malId: number): Promise<number[]> {
  // Две попытки вместо шести: обход инкрементальный, и провал тут стоит
  // дёшево — вернёмся к этому тайтлу следующим прогоном. Долгие ретраи на
  // нестабильном Jikan съедают весь бюджет времени впустую.
  const data = await get<{
    data: { relation: string; entry: { mal_id: number; type: string }[] }[];
  }>(`/anime/${malId}/relations`, 1, 2);

  const ids = new Set<number>();

  for (const group of data.data ?? []) {
    if (!WANTED_RELATIONS.has(group.relation)) continue;
    for (const entry of group.entry) {
      if (entry.type === "anime") ids.add(entry.mal_id);
    }
  }

  return [...ids];
}

/**
 * Длительность из Jikan приходит строкой в свободной форме:
 * «24 min per ep», «1 hr 52 min», «23 min», «Unknown».
 * Приводим к минутам — на этом держится весь расчёт времени.
 */
export function parseDuration(raw: string | null): number | null {
  if (!raw) return null;

  const text = raw.toLowerCase();
  if (text.includes("unknown")) return null;

  const hours = Number(text.match(/(\d+)\s*hr/)?.[1] ?? 0);
  const minutes = Number(text.match(/(\d+)\s*min/)?.[1] ?? 0);
  const seconds = Number(text.match(/(\d+)\s*sec/)?.[1] ?? 0);

  const total = hours * 60 + minutes + Math.round(seconds / 60);

  // Ноль значит, что распарсить не вышло — честнее вернуть null.
  return total > 0 ? total : null;
}

const STATUS_MAP: Record<string, string> = {
  "Currently Airing": "releasing",
  "Finished Airing": "finished",
  "Not yet aired": "not_yet_aired",
};

/** Jikan -> форма нашей модели Title (без slug/hue — их проставляет вызывающий). */
export function normalize(a: JikanAnime) {
  return {
    malId: a.mal_id,
    title: a.title_english?.trim() || a.title,
    titleJp: a.title_japanese,
    synopsis: a.synopsis,
    posterUrl: a.images?.jpg?.large_image_url ?? null,
    bannerUrl: a.trailer?.images?.maximum_image_url ?? null,
    year: a.year,
    season: a.season,
    format: a.type,
    status: a.status ? (STATUS_MAP[a.status] ?? null) : null,
    score: a.score,
    episodesCount: a.episodes,
    durationMin: parseDuration(a.duration),
    genreNames: a.genres?.map((g) => g.name) ?? [],
  };
}
