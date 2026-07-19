/** Подписи статусов. Отдельный файл, потому что из "use server" можно
 *  экспортировать только async-функции. */
export const WATCH_STATUSES = {
  watching: "Смотрю",
  planned: "Запланировано",
  completed: "Посмотрел",
  dropped: "Брошено",
} as const;

export type WatchStatus = keyof typeof WATCH_STATUSES;

export const STATUS_ORDER = Object.keys(WATCH_STATUSES) as WatchStatus[];

export function isWatchStatus(value: string): value is WatchStatus {
  return value in WATCH_STATUSES;
}
