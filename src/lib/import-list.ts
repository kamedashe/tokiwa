/**
 * Импорт списка с MyAnimeList и Shikimori.
 *
 * С MAL живого импорта по нику не сделать: эндпоинт списков закрыт на их
 * стороне (Jikan отвечает 504, хотя соседние эндпоинты работают). Поэтому
 * оттуда — только XML-выгрузка, которую пользователь скачивает сам на
 * myanimelist.net/panel.php?go=export и загружает файлом.
 *
 * С Shikimori проще: их API открыт, а id аниме у них совпадает с malId
 * (см. lib/shikimori.ts), поэтому список сразу ложится на наш каталог без
 * промежуточного сопоставления.
 */

import { gunzipSync } from "node:zlib";
import type { WatchStatus } from "@/lib/watch-status";

const SHIKIMORI_BASE = "https://shikimori.one/api";
const HEADERS = { "User-Agent": "TokiWa", accept: "application/json" };

/** Одна запись чужого списка, уже приведённая к нашим понятиям. */
export interface ImportedEntry {
  malId: number;
  status: WatchStatus;
  progress: number;
}

/**
 * У обоих источников статусов больше, чем у нас. «Пересматриваю» — это всё
 * ещё просмотр, а «отложено» ближе к «запланировано»: человек собирается
 * вернуться, а не бросил.
 */
const STATUS_MAP: Record<string, WatchStatus> = {
  watching: "watching",
  rewatching: "watching",
  completed: "completed",
  dropped: "dropped",
  planned: "planned",
  on_hold: "planned",
  // Написание из XML-выгрузки MAL.
  "plan to watch": "planned",
  "on-hold": "planned",
};

function toStatus(raw: string): WatchStatus | null {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? null;
}

/* -------------------------------------------------------------------------- */
/*                                 Shikimori                                  */
/* -------------------------------------------------------------------------- */

interface ShikimoriUser {
  id: number;
  nickname: string;
}

interface ShikimoriRate {
  status: string;
  episodes: number;
  anime: { id: number } | null;
}

async function shikimori<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SHIKIMORI_BASE}${path}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Ник → числовой id. Поиск нестрогий, поэтому сверяем точное совпадение. */
async function resolveShikimoriUser(nickname: string): Promise<ShikimoriUser | null> {
  const found = await shikimori<ShikimoriUser[]>(
    `/users?search=${encodeURIComponent(nickname)}&limit=20`,
  );
  if (!found?.length) return null;

  const wanted = nickname.trim().toLowerCase();
  return found.find((u) => u.nickname.toLowerCase() === wanted) ?? null;
}

/**
 * Список пользователя целиком. API отдаёт постранично и, что важно, при
 * `limit=N` возвращает N+1 запись — лишнюю обрезаем, иначе она продублируется
 * на следующей странице.
 */
export async function fetchShikimoriList(
  nickname: string,
): Promise<{ ok: true; entries: ImportedEntry[] } | { ok: false; reason: "notFound" | "failed" }> {
  const user = await resolveShikimoriUser(nickname);
  if (!user) return { ok: false, reason: "notFound" };

  const PAGE_SIZE = 100;
  const MAX_PAGES = 60; // 6000 тайтлов — заведомо больше любого реального списка
  const entries: ImportedEntry[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const rates = await shikimori<ShikimoriRate[]>(
      `/users/${user.id}/anime_rates?limit=${PAGE_SIZE}&page=${page}`,
    );
    if (!rates) return { ok: false, reason: "failed" };

    for (const rate of rates.slice(0, PAGE_SIZE)) {
      const status = toStatus(rate.status);
      if (!status || !rate.anime) continue;

      entries.push({
        malId: rate.anime.id,
        status,
        progress: Math.max(0, rate.episodes ?? 0),
      });
    }

    if (rates.length <= PAGE_SIZE) break;
  }

  return { ok: true, entries };
}

/* -------------------------------------------------------------------------- */
/*                              MyAnimeList (XML)                             */
/* -------------------------------------------------------------------------- */

const TAG = {
  anime: /<anime>([\s\S]*?)<\/anime>/g,
  malId: /<series_animedb_id>(\d+)<\/series_animedb_id>/,
  status: /<my_status>([\s\S]*?)<\/my_status>/,
  progress: /<my_watched_episodes>(\d+)<\/my_watched_episodes>/,
};

/** Значения приходят в CDATA — снимаем обёртку, если она есть. */
function unwrap(value: string): string {
  const cdata = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return (cdata ? cdata[1] : value).trim();
}

/**
 * Разбор выгрузки MAL. Формат простой и плоский, поэтому обходимся регулярками
 * вместо полноценного XML-парсера — лишняя зависимость ради четырёх тегов
 * не окупается.
 */
export function parseMalXml(xml: string): ImportedEntry[] {
  const entries: ImportedEntry[] = [];

  for (const [, block] of xml.matchAll(TAG.anime)) {
    const malId = Number(block.match(TAG.malId)?.[1]);
    if (!malId) continue;

    const rawStatus = block.match(TAG.status)?.[1];
    const status = rawStatus ? toStatus(unwrap(rawStatus)) : null;
    if (!status) continue;

    entries.push({
      malId,
      status,
      progress: Number(block.match(TAG.progress)?.[1] ?? 0),
    });
  }

  return entries;
}

/** MAL отдаёт выгрузку gzip-ом, но пользователь мог распаковать её сам. */
export function readMalExport(buffer: Buffer): ImportedEntry[] {
  const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
  const xml = (isGzip ? gunzipSync(buffer) : buffer).toString("utf-8");
  return parseMalXml(xml);
}
