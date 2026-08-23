/**
 * Ступени по объёму просмотренного.
 *
 * Заменяют сравнение с другими пользователями: перцентиль на полусотне
 * заполненных списков — красивая, но пустая цифра, «обошёл 87%» означало бы
 * «обошёл тридцать человек». Ступени работают на любой базе и никого не
 * вводят в заблуждение: пороги фиксированные и понятные.
 *
 * Границы подобраны по реальному распределению августа 2026 — в каждую
 * ступень попадает от 12 до 23% людей, так что титул что-то значит и при
 * этом достижим.
 */

export interface Tier {
  key: string;
  /** Нижняя граница в часах просмотренного. */
  hours: number;
}

export const TIERS: Tier[] = [
  { key: "novice", hours: 0 },
  { key: "viewer", hours: 24 },
  { key: "fan", hours: 100 },
  { key: "veteran", hours: 240 },
  { key: "marathoner", hours: 720 },
  { key: "legend", hours: 2400 },
];

export interface TierProgress {
  current: Tier;
  /** Следующая ступень или null — дальше некуда. */
  next: Tier | null;
  /** Сколько часов осталось до следующей. */
  hoursToNext: number;
  /** Пройденная доля до следующей ступени, 0–100. */
  percent: number;
}

export function getTier(watchedMinutes: number): TierProgress {
  const hours = watchedMinutes / 60;

  let index = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (hours >= TIERS[i].hours) {
      index = i;
      break;
    }
  }

  const current = TIERS[index];
  const next = TIERS[index + 1] ?? null;

  if (!next) return { current, next: null, hoursToNext: 0, percent: 100 };

  const span = next.hours - current.hours;
  const done = hours - current.hours;

  return {
    current,
    next,
    hoursToNext: Math.max(1, Math.ceil(next.hours - hours)),
    percent: Math.min(99, Math.round((done / span) * 100)),
  };
}

/**
 * Часы во что-то осязаемое. Само по себе «243 часа» человеку ни о чём не
 * говорит — именно перевод в дни жизни сделал страницу итогов той, которой
 * делятся. Единица подбирается по величине: у маленьких списков сутки
 * выглядят смешно, у больших смешно выглядят фильмы.
 */
export function pickComparison(watchedMinutes: number): { key: string; value: number } | null {
  const hours = watchedMinutes / 60;

  // Полнометражки — понятная мера для небольших списков.
  if (hours < 100) return { key: "movies", value: Math.max(1, Math.round(hours / 2)) };

  // Рабочие недели: сорок часов, знакомо каждому, кто работал.
  if (hours < 720) return { key: "workWeeks", value: Math.max(1, Math.round(hours / 40)) };

  // Дальше уже месяцы непрерывного просмотра.
  return { key: "months", value: Math.max(1, Math.round(hours / 24 / 30)) };
}
