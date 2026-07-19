/**
 * Расчёт времени по бэклогу. Чистые функции без обращений к БД — их удобно
 * тестировать и переиспользовать в любом месте.
 */

/** Когда Jikan не отдал длительность, берём типовую серию ТВ-сериала. */
export const FALLBACK_DURATION_MIN = 24;

export interface TimedTitle {
  episodesCount: number | null;
  durationMin: number | null;
  format: string | null;
}

/**
 * Сколько минут занимает тайтл целиком.
 *
 * У фильмов `durationMin` — это длительность всего фильма, а не серии,
 * поэтому умножать на число серий нельзя.
 */
export function totalMinutes(title: TimedTitle): number {
  const perEpisode = title.durationMin ?? FALLBACK_DURATION_MIN;

  if (title.format === "Movie") return perEpisode;

  const episodes = title.episodesCount ?? 1;
  return perEpisode * episodes;
}

/** Сколько осталось досмотреть с учётом прогресса. */
export function remainingMinutes(title: TimedTitle, progress: number): number {
  if (title.format === "Movie") return progress > 0 ? 0 : totalMinutes(title);

  const episodes = title.episodesCount ?? 1;
  const left = Math.max(0, episodes - progress);
  return (title.durationMin ?? FALLBACK_DURATION_MIN) * left;
}

/** «312 ч 40 мин» → человекочитаемо и коротко. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 мин";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins} мин`;
  if (hours < 100 && mins > 0) return `${hours} ч ${mins} мин`;
  return `${hours} ч`;
}

/**
 * Сколько это в днях при заданном темпе. Нужен, чтобы абстрактные «312 часов»
 * превратились во что-то осязаемое.
 */
export function paceEstimate(minutes: number, minutesPerDay: number): string {
  if (minutes <= 0 || minutesPerDay <= 0) return "";

  const days = Math.ceil(minutes / minutesPerDay);
  if (days <= 1) return "меньше дня";
  if (days < 14) return `${days} ${plural(days, "день", "дня", "дней")}`;

  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks} ${plural(weeks, "неделя", "недели", "недель")}`;

  const months = Math.round(days / 30);
  if (months < 24) return `${months} ${plural(months, "месяц", "месяца", "месяцев")}`;

  const years = (days / 365).toFixed(1).replace(".", ",");
  return `${years} года`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Пресеты бюджета времени. Значения в минутах. */
export const TIME_BUDGETS = [
  { key: "evening", label: "Вечер", hint: "2 часа", minutes: 120 },
  { key: "night", label: "Ночь напролёт", hint: "6 часов", minutes: 360 },
  { key: "weekend", label: "Выходные", hint: "12 часов", minutes: 720 },
  { key: "vacation", label: "Отпуск", hint: "40 часов", minutes: 2400 },
] as const;

export type BudgetKey = (typeof TIME_BUDGETS)[number]["key"];

export function budgetMinutes(key: string): number | null {
  return TIME_BUDGETS.find((b) => b.key === key)?.minutes ?? null;
}
