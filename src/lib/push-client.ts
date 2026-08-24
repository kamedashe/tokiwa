"use client";

import { subscribeToPush } from "@/lib/push-actions";

/**
 * Браузерная половина пушей: спросить разрешение и зарегистрировать подписку.
 *
 * Живёт отдельно, потому что спрашиваем мы в двух местах — переключателем
 * в «моём списке» и плашкой на странице тайтла сразу после «смотрю», — а
 * расходиться этим двум местам нельзя: подписка одна на браузер.
 */

export type PushSupport = "ok" | "needs-install" | "unsupported";

/** Есть ли пуши в этом браузере и не надо ли сперва поставить сайт на «Домой». */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if ("serviceWorker" in navigator && "PushManager" in window) return "ok";

  // На iPhone пуши доступны только сайту, добавленному на «Домой»: в обычной
  // вкладке Safari PushManager отсутствует вовсе, и это не «не поддерживает»,
  // а «ещё не установлен» — разница важная, ответы у них разные.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? "needs-install" : "unsupported";
}

/** Уже подписан? Спрашиваем браузер, а не сервер — это бесплатно. */
export async function alreadySubscribed(): Promise<boolean> {
  if (pushSupport() !== "ok" || Notification.permission !== "granted") return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(await registration?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export type EnableResult = "on" | "blocked" | "failed";

/**
 * Спрашивает системное разрешение и заводит подписку.
 *
 * Вызывать только по явному нажатию человека: решение браузер запоминает
 * навсегда, и отказ закрывает канал для этого устройства без второй попытки.
 */
export async function enablePush(vapidKey: string): Promise<EnableResult> {
  if (pushSupport() !== "ok") return "failed";

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "blocked" : "failed";

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });

    const json = sub.toJSON();
    await subscribeToPush({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    });

    return "on";
  } catch {
    return "failed";
  }
}
