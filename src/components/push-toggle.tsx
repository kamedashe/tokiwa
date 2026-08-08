"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push-actions";

/**
 * Включение пушей — единственный канал возврата, доступный без регистрации:
 * подписка живёт в браузере, как и гостевой список.
 *
 * Ключ VAPID приходит пропом с сервера: он публичный по своей природе, но
 * подставлять его в клиентский бандл через переменную окружения незачем.
 */
export function PushToggle({
  vapidKey,
  initiallyOn,
  labels,
}: {
  vapidKey: string;
  initiallyOn: boolean;
  labels: {
    title: string;
    text: string;
    enable: string;
    enabled: string;
    disable: string;
    blocked: string;
    iosHint: string;
    working: string;
  };
}) {
  const [state, setState] = useState<"unknown" | "off" | "on" | "blocked" | "unsupported">(
    "unknown",
  );
  const [busy, setBusy] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // На iPhone пуши есть только у сайта, добавленного на «Домой», —
      // в обычной вкладке Safari PushManager отсутствует вовсе.
      const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
      setNeedsInstall(isIos);
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }

    setState(initiallyOn ? "on" : "off");
  }, [initiallyOn]);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

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

      setState("on");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await unsubscribeFromPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  // До выяснения состояния ничего не рисуем: мигание «включить → включено»
  // выглядит как сбой.
  if (state === "unknown") return null;
  if (state === "unsupported" && !needsInstall) return null;

  return (
    <div className="rounded-2xl border border-hairline bg-white/[0.02] px-5 py-4">
      <div className="font-display text-[14px] font-semibold">{labels.title}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {state === "blocked"
          ? labels.blocked
          : needsInstall
            ? labels.iosHint
            : labels.text}
      </p>

      {state === "off" && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="mt-3 rounded-full bg-accent px-5 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft disabled:opacity-60"
        >
          {busy ? labels.working : labels.enable}
        </button>
      )}

      {state === "on" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-accent">✓ {labels.enabled}</span>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="text-[12px] text-dim transition-colors hover:text-foreground disabled:opacity-60"
          >
            {labels.disable}
          </button>
        </div>
      )}
    </div>
  );
}
