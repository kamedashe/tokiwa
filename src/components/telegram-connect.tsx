"use client";

import { useState, useTransition } from "react";
import { TelegramIcon } from "@/components/telegram-icon";
import { createTelegramLink, unlinkTelegram } from "@/lib/telegram-actions";

/**
 * Подключение уведомлений о новых сериях. Кнопка выдаёт ссылку на бота с
 * одноразовым кодом — после /start бот знает, чей это список.
 */
export function TelegramConnect({
  linked,
  labels,
}: {
  linked: boolean;
  labels: {
    title: string;
    text: string;
    connect: string;
    open: string;
    linked: string;
    unlink: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState(linked);

  const connect = () => {
    startTransition(async () => {
      const result = await createTelegramLink();
      if (result.ok) {
        setUrl(result.url);
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    });
  };

  const unlink = () => {
    startTransition(async () => {
      const result = await unlinkTelegram();
      if (result.ok) {
        setIsLinked(false);
        setUrl(null);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-hairline bg-white/[0.02] px-5 py-4">
      <TelegramIcon className="size-9 shrink-0 rounded-full bg-[#2AABEE]/15 p-2 text-[#2AABEE]" />

      <div className="min-w-0 flex-1">
        <div className="font-display text-[14px] font-semibold">{labels.title}</div>
        <p className="mt-0.5 text-[12px] text-muted">{labels.text}</p>
      </div>

      {isLinked ? (
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-accent">✓ {labels.linked}</span>
          <button
            type="button"
            onClick={unlink}
            disabled={pending}
            className="text-[12px] text-dim transition-colors hover:text-foreground disabled:opacity-60"
          >
            {labels.unlink}
          </button>
        </div>
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[#2AABEE]/40 px-4 py-1.5 text-[13px] text-[#2AABEE] transition-colors hover:border-[#2AABEE]"
        >
          {labels.open} →
        </a>
      ) : (
        <button
          type="button"
          onClick={connect}
          disabled={pending}
          className="rounded-full border border-[#2AABEE]/40 px-4 py-1.5 text-[13px] text-[#2AABEE] transition-colors hover:border-[#2AABEE] disabled:opacity-60"
        >
          {labels.connect}
        </button>
      )}
    </div>
  );
}
