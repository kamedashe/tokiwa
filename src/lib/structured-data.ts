/**
 * JSON-LD для карточек аниме. Без него Google видит просто текст и сам гадает,
 * что на странице; с ним — понимает, что это сериал, сколько серий и какого года.
 */

import { localeAlternates } from "@/lib/seo";

interface TitleForJsonLd {
  slug: string;
  synopsis: string | null;
  posterUrl: string | null;
  titleJp: string | null;
  year: number | null;
  format: string | null;
  episodesCount: number | null;
  durationMin: number | null;
  genres: { name: string }[];
}

/**
 * Оценку (score) намеренно не отдаём как aggregateRating. Во-первых, это оценка
 * MyAnimeList, а не наших пользователей — выдавать её за свою значит вводить
 * поисковик в заблуждение. Во-вторых, Google требует к рейтингу ratingCount,
 * которого у нас в базе нет, и разметка без него всё равно невалидна.
 * За такое прилетают ручные санкции, поэтому лучше меньше, да честно.
 */
export function animeJsonLd(
  title: TitleForJsonLd,
  displayName: string,
  locale: string,
): Record<string, unknown> {
  const isMovie = title.format === "Movie";
  const url = localeAlternates(`/anime/${title.slug}`)[locale];

  // Синонимы названия помогают склеить страницу с запросами на другом языке.
  const alternateName = [title.titleJp].filter(
    (v): v is string => Boolean(v) && v !== displayName,
  );

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": isMovie ? "Movie" : "TVSeries",
    name: displayName,
    url,
    // Оригинальный язык произведения, а не язык страницы.
    inLanguage: "ja",
  };

  if (alternateName.length > 0) data.alternateName = alternateName;
  if (title.synopsis) data.description = title.synopsis;
  if (title.posterUrl) data.image = title.posterUrl;
  if (title.year) data.datePublished = String(title.year);
  if (title.genres.length > 0) data.genre = title.genres.map((g) => g.name);

  if (isMovie) {
    // ISO 8601: 24 минуты — PT24M.
    if (title.durationMin) data.duration = `PT${title.durationMin}M`;
  } else if (title.episodesCount) {
    data.numberOfEpisodes = title.episodesCount;
  }

  return data;
}

/**
 * JSON.stringify не экранирует «<», поэтому синопсис с «</script>» из внешнего
 * API мог бы закрыть тег и выполнить всё, что идёт следом. Данные у нас
 * приходят из Jikan, то есть доверять им нельзя.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
