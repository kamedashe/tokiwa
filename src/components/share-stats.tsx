"use client";

import { useState } from "react";

/**
 * «Поделиться итогами». На телефонах — системное меню шаринга, на десктопе —
 * копирование в буфер. Текст собирает сервер: там уже посчитаны часы и жанры.
 */
export function ShareStats({
  text,
  labels,
}: {
  text: string;
  labels: { share: string; copied: string };
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Отменил системное меню — не считаем ошибкой и ничего не делаем.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер запрещён — молчим, кнопка просто не сработает.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-full bg-accent px-6 py-2.5 text-[14px] font-bold text-ink transition-colors hover:bg-accent-soft"
    >
      {copied ? `✓ ${labels.copied}` : labels.share}
    </button>
  );
}
