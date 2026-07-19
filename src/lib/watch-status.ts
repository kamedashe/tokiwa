/**
 * Статусы просмотра. Здесь только ключи — подписи живут в словарях под
 * `status.*`, потому что их четыре штуки на каждый язык.
 */
export const STATUS_ORDER = ["watching", "planned", "completed", "dropped"] as const;

export type WatchStatus = (typeof STATUS_ORDER)[number];

export function isWatchStatus(value: string): value is WatchStatus {
  return (STATUS_ORDER as readonly string[]).includes(value);
}
