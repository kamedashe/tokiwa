"use client";

import { useState } from "react";

/**
 * Шаринг итогов. Главная кнопка отдаёт картинку 1080×1920 — формат сторис,
 * его и репостят; текстом делятся куда реже.
 *
 * Отправить файл умеет только Web Share второго уровня (телефоны), поэтому
 * на десктопе картинка просто скачивается — оттуда её всё равно перетащат
 * в пост руками.
 */
export function ShareStats({
  locale,
  text,
  labels,
}: {
  locale: string;
  text: string;
  labels: { shareImage: string; preparing: string; shareTextOnly: string; copied: string };
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareImage = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/wrapped-image?locale=${locale}`);
      if (!res.ok) return;

      const blob = await res.blob();
      const file = new File([blob], "tokiwa.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch {
          // Закрыл системное меню — не ошибка, просто выходим.
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tokiwa.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Сеть отвалилась — кнопка просто вернётся в исходное состояние.
    } finally {
      setBusy(false);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер запрещён — молчим.
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={shareImage}
        disabled={busy}
        className="rounded-full bg-accent px-6 py-2.5 text-[14px] font-bold text-ink transition-colors hover:bg-accent-soft disabled:opacity-60"
      >
        {busy ? labels.preparing : labels.shareImage}
      </button>

      <button
        type="button"
        onClick={copyText}
        className="text-[13px] text-dim transition-colors hover:text-foreground"
      >
        {copied ? `✓ ${labels.copied}` : labels.shareTextOnly}
      </button>
    </div>
  );
}
