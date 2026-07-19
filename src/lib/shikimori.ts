/**
 * Shikimori — русские названия. Он построен вокруг тех же MAL-идентификаторов,
 * что и Jikan, поэтому связывать ничего не надо: тот же malId.
 *
 * Ни AniList, ни Jikan русских названий не отдают, так что это единственный
 * вменяемый источник.
 */

const BASE = "https://shikimori.one/api";
/** Картинки отдаёт другой домен: с .one прилетает 301 на .io. Сохраняем
 *  сразу конечный адрес, чтобы оптимизатор картинок не ходил через редирект. */
const IMAGE_SITE = "https://shikimori.io";

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

/* -------------------------------------------------------------------------- */
/*                     Полные метаданные — для импорта списков                */
/* -------------------------------------------------------------------------- */

interface ShikimoriAnime {
  id: number;
  myanimelist_id: number | null;
  name: string;
  russian: string | null;
  english: (string | null)[] | null;
  japanese: (string | null)[] | null;
  description: string | null;
  image: { original?: string | null } | null;
  kind: string | null;
  status: string | null;
  score: string | null;
  episodes: number | null;
  duration: number | null;
  aired_on: string | null;
  genres: { name: string; kind: string }[] | null;
}

const KIND_MAP: Record<string, string> = {
  tv: "TV",
  movie: "Movie",
  ova: "OVA",
  ona: "ONA",
  special: "Special",
  music: "Music",
  tv_special: "Special",
};

const STATUS_MAP: Record<string, string> = {
  released: "finished",
  ongoing: "releasing",
  anons: "not_yet_aired",
};

function seasonOf(month: number): string {
  if (month <= 3) return "winter";
  if (month <= 6) return "spring";
  if (month <= 9) return "summer";
  return "fall";
}

/** В описаниях у них своя разметка вида [character=123]Имя[/character]. */
function stripMarkup(text: string | null): string | null {
  if (!text) return null;
  const clean = text
    .replace(/\[\/?[a-z_]+(=[^\]]*)?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || null;
}

function first(values: (string | null)[] | null): string | null {
  return values?.find((v) => v?.trim())?.trim() ?? null;
}

/**
 * Полные метаданные тайтла. Нужны импорту списков: Jikan на точечных
 * запросах стабильно отваливается в 504, а Shikimori отвечает надёжно и
 * заметно быстрее — при том, что id у них тот же самый malId.
 */
export async function fetchAnimeDetails(malId: number) {
  await throttle();

  const res = await fetch(`${BASE}/animes/${malId}`, {
    headers: { "User-Agent": "TokiWa", accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;

  const a = (await res.json()) as ShikimoriAnime;
  if (!a?.name) return null;

  const aired = a.aired_on ? new Date(a.aired_on) : null;
  const poster = a.image?.original;

  return {
    malId: a.myanimelist_id ?? a.id,
    title: first(a.english) || a.name,
    titleJp: first(a.japanese),
    titleRu: a.russian?.trim() || null,
    synopsis: stripMarkup(a.description),
    // Пути к картинкам относительные — без хоста Next их не отдаст.
    posterUrl: poster ? `${IMAGE_SITE}${poster}` : null,
    bannerUrl: null,
    year: aired ? aired.getUTCFullYear() : null,
    season: aired ? seasonOf(aired.getUTCMonth() + 1) : null,
    format: a.kind ? (KIND_MAP[a.kind] ?? null) : null,
    status: a.status ? (STATUS_MAP[a.status] ?? null) : null,
    score: a.score ? Number(a.score) || null : null,
    episodesCount: a.episodes || null,
    // У них длительность уже в минутах, разбирать строку не надо.
    durationMin: a.duration || null,
    genreNames: (a.genres ?? []).filter((g) => g.kind === "genre").map((g) => g.name),
  };
}
