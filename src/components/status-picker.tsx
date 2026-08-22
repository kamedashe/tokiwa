"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { setStatus } from "@/lib/watchlist";
import { STATUS_ORDER } from "@/lib/watch-status";
import { ENTRY_CHANGED } from "@/lib/entry-events";

/** Выбор статуса на странице тайтла: смотрю / запланировано / посмотрел / брошено. */
export function StatusPicker({
  titleId,
  initialStatus,
}: {
  titleId: number;
  initialStatus: string | null;
}) {
  const t = useTranslations("status");
  const router = useRouter();
  const [current, setCurrent] = useState(initialStatus);
  const [pending, startTransition] = useTransition();

  const pick = (status: string) => {
    const previous = current;
    setCurrent(status);

    startTransition(async () => {
      const result = await setStatus(titleId, status);

      if (!result.ok) {
        setCurrent(previous);
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      // «Посмотрел» проставляет полный прогресс на сервере — счётчик серий
      // стоит в другой части страницы и сам об этом не узнает, поэтому
      // сообщаем ему напрямую.
      if (result.progress != null) {
        window.dispatchEvent(
          new CustomEvent(ENTRY_CHANGED, { detail: { titleId, progress: result.progress } }),
        );
      }

      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_ORDER.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => pick(key)}
          disabled={pending}
          aria-pressed={current === key}
          className={`rounded-full px-3.5 py-2 text-[12px] transition-colors disabled:opacity-60 ${
            current === key
              ? "bg-accent font-semibold text-ink"
              : "border border-hairline bg-white/[0.03] text-muted hover:border-white/20 hover:text-foreground"
          }`}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}
