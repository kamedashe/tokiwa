/**
 * Shikimori — русские названия. Он построен вокруг тех же MAL-идентификаторов,
 * что и Jikan, поэтому связывать ничего не надо: тот же malId.
 *
 * Ни AniList, ни Jikan русских названий не отдают, так что это единственный
 * вменяемый источник.
 */

const BASE = "https://shikimori.one/api";

/** Лимит — 5 запросов в секунду и 90 в минуту. Берём с запасом. */
const MIN_INTERVAL_MS = 700;
let lastRequestAt = 0;

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export async function fetchRussianTitle(malId: number, attempt = 1): Promise<string | null> {
  const MAX_ATTEMPTS = 3;
  await throttle();

  let res: Response;
  try {
    res = await fetch(`${BASE}/animes/${malId}`, {
      // Shikimori требует внятный User-Agent, иначе режет запросы.
      headers: { "User-Agent": "TokiWa", accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    if (attempt >= MAX_ATTEMPTS) return null;
    await new Promise((r) => setTimeout(r, attempt * 1500));
    return fetchRussianTitle(malId, attempt + 1);
  }

  if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
    await new Promise((r) => setTimeout(r, attempt * 2000));
    return fetchRussianTitle(malId, attempt + 1);
  }

  if (!res.ok) return null;

  const data = (await res.json()) as { russian?: string | null };
  const russian = data?.russian?.trim();

  return russian ? russian : null;
}
