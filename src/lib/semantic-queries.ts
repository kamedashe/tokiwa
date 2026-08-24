/**
 * Смысловой поиск для страницы: разбор запроса, вектор, карточки.
 *
 * Здесь же живёт кэш векторов запросов. Строка «что-нибудь тихое» у разных
 * людей одна и та же, а каждый её вектор — это поход в Voyage на четыреста
 * миллисекунд. Кэш в памяти процесса: на Vercel инстансы недолговечны, но
 * внутри одного всплеска запросов повторы ловятся, а это ровно тот случай,
 * когда все спрашивают одно и то же.
 */
import { CardTitle } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { parseQuery } from "@/lib/query-filters";
import { searchByVector, TONE_WEIGHT } from "@/lib/semantic-search";
import { pickTitle } from "@/lib/title-locale";
import { embedQuery } from "@/lib/voyage";

export type SemanticResult = {
  items: CardTitle[];
  /** Распознанные условия человеческим языком — их показываем над выдачей. */
  matched: string[];
  /** Что из запроса досталось модели после вырезания условий. */
  semanticText: string;
};

/** Больше тысячи разных запросов на инстанс не ждём, но потолок нужен. */
const CACHE_LIMIT = 500;
const cache = new Map<string, number[]>();

async function cachedEmbedding(text: string): Promise<number[]> {
  const key = text.toLowerCase().replace(/\s+/g, " ").trim();
  const hit = cache.get(key);
  if (hit) {
    // Обновляем позицию: Map хранит порядок вставки, и вытесняем мы самый
    // давний ключ — без переноса он вытеснится, даже если спрашивают часто.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const vector = await embedQuery(text);
  cache.set(key, vector);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return vector;
}

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  titleRu: true,
  titleJp: true,
  posterUrl: true,
  hue: true,
  score: true,
  genres: { select: { name: true }, take: 2 },
} as const;

export async function semanticSearch(
  query: string,
  locale: string,
  limit = 24,
): Promise<SemanticResult> {
  const parsed = parseQuery(query);

  // Запрос может состоять из одних условий: «полнометражки 2020-х». Векторизовать
  // пустоту нечего, поэтому в модель уходит исходная строка — она хотя бы
  // задаёт тему, а условия всё равно отработают в WHERE.
  const semanticText = parsed.text || query;

  const vector = await cachedEmbedding(semanticText);
  const hits = await searchByVector(vector, limit, TONE_WEIGHT, parsed.filters);
  if (!hits.length) return { items: [], matched: parsed.matched, semanticText };

  // Карточке нужно больше полей, чем поиску: постер, слаг, жанры. Тянем их
  // отдельным запросом по найденным id и раскладываем обратно в том порядке,
  // который дал поиск, — иначе порядок задаст база, то есть никакой.
  const ids = hits.map((h) => h.id);
  const rows = await prisma.title.findMany({ where: { id: { in: ids } }, select: CARD_SELECT });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const items = ids.flatMap((id) => {
    const r = byId.get(id);
    if (!r) return [];
    const names = pickTitle(r, locale);
    return [
      {
        id: r.id,
        slug: r.slug,
        title: names.title,
        original: names.original,
        posterUrl: r.posterUrl,
        hue: r.hue,
        score: r.score,
        tags: r.genres.map((g) => g.name).join(" · "),
      },
    ];
  });

  return { items, matched: parsed.matched, semanticText };
}
