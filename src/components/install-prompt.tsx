"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "tokiwa-install-dismissed";

/**
 * Подсказка «поставьте на главный экран». Нужна прежде всего iPhone: Safari
 * не показывает баннер установки вовсе, и без объяснения люди просто не знают,
 * что сайт можно поставить. Android свой баннер показывает сам, но не всегда
 * и не сразу — там подсказка тоже не лишняя.
 *
 * Показываем только на телефонах и только гостям браузера, которые ещё не
 * установили приложение и не закрывали подсказку.
 */
export function InstallPrompt({
  labels,
}: {
  labels: { title: string; ios: string; android: string; close: string };
}) {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Уже установлено — подсказывать нечего.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari до сих пор держит собственный флаг вместо display-mode.
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    if (!isIos && !isAndroid) return;

    // Даём осмотреться: подсказка сразу на входе воспринимается как реклама.
    const timer = setTimeout(() => setPlatform(isIos ? "ios" : "android"), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!platform) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setPlatform(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-[76px] z-50 rounded-2xl border border-accent/30 bg-surface/95 p-4 shadow-xl backdrop-blur-lg md:hidden">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-[14px] font-semibold">{labels.title}</div>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            {platform === "ios" ? labels.ios : labels.android}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={labels.close}
          className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-1 text-[18px] leading-none text-dim transition-colors hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}
