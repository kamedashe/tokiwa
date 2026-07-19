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
/** Переводчик из next-intl — принимаем его, чтобы модуль не зависел от React. */
type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Разбивает минуты на часы и минуты. Чистая функция: само склонение и порядок
 * слов у каждого языка свои, поэтому склейкой строк занимается словарь.
 */
export function splitDuration(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/** «3 ч 4 мин» на языке пользователя. */
export function formatDuration(t: Translate, total: number): string {
  if (total <= 0) return t('minutes', { count: 0 });

  const { hours, minutes } = splitDuration(total);

  if (hours === 0) return t('minutes', { count: minutes });
  // У длинных сроков минуты уже не важны и только мешают читать.
  if (hours < 100 && minutes > 0) return t('hoursMinutes', { hours, minutes });
  return t('hours', { count: hours });
}

/**
 * Сколько это в днях при заданном темпе. Нужен, чтобы абстрактные «312 часов»
 * превратились во что-то осязаемое. Склонение числительных берёт на себя
 * ICU-разметка в словаре — в русском и украинском формы разные.
 */
export function paceEstimate(t: Translate, minutes: number, minutesPerDay: number): string {
  if (minutes <= 0 || minutesPerDay <= 0) return '';

  const days = Math.ceil(minutes / minutesPerDay);
  if (days <= 1) return t('lessThanDay');
  if (days < 14) return t('days', { count: days });

  const weeks = Math.round(days / 7);
  if (weeks < 9) return t('weeks', { count: weeks });

  const months = Math.round(days / 30);
  if (months < 24) return t('months', { count: months });

  return t('years', { count: (days / 365).toFixed(1) });
}

/**
 * Пресеты бюджета времени. Подписи лежат в словаре под теми же ключами
 * (backlog.evening и так далее), здесь только числа.
 */
export const TIME_BUDGETS = [
  { key: "evening", hours: 2, minutes: 120 },
  { key: "night", hours: 6, minutes: 360 },
  { key: "weekend", hours: 12, minutes: 720 },
  { key: "vacation", hours: 40, minutes: 2400 },
] as const;

export type BudgetKey = (typeof TIME_BUDGETS)[number]["key"];

export function budgetMinutes(key: string): number | null {
  return TIME_BUDGETS.find((b) => b.key === key)?.minutes ?? null;
}
