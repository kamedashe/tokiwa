"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { setProgress } from "@/lib/watchlist";

/**
 * Счётчик просмотренных серий — основной жест в трекере, поэтому «+1» стоит
 * крупно и первым. Гостя уводим на логин, а не глотаем клик.
 *
 * Для длинных сериалов «+1» бесполезен — у «Блича» 366 серий, — поэтому под
 * счётчиком раскрывается сетка номеров: клик по номеру отмечает всё до него,
 * повторный клик по последней отмеченной снимает её (промахи случаются).
 */
export function ProgressStepper({
  titleId,
  initialProgress,
  episodesCount,
}: {
  titleId: number;
  initialProgress: number;
  episodesCount: number | null;
}) {
  const t = useTranslations("title");
  const router = useRouter();
  const [value, setValue] = useState(initialProgress);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  const max = episodesCount ?? Infinity;
  const done = episodesCount !== null && value >= episodesCount;

  const commit = (next: number) => {
    const clamped = Math.max(0, Math.min(next, max === Infinity ? next : max));
    if (clamped === value) return;

    const previous = value;
    setValue(clamped);

    startTransition(async () => {
      const result = await setProgress(titleId, clamped);
      if (!result.ok) {
        setValue(previous);
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => commit(value + 1)}
          disabled={pending || done}
          className="rounded-full bg-accent px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-accent-soft disabled:opacity-40"
        >
          {done ? t("allWatched") : t("plusOne")}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => commit(value - 1)}
            disabled={pending || value === 0}
            aria-label={t("removeEpisode")}
            className="size-9 rounded-lg border border-hairline text-muted transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-40"
          >
            −
          </button>

          <span className="min-w-[86px] text-center font-display text-[17px] font-semibold tabular-nums">
            {value}
            <span className="text-dim"> / {episodesCount ?? "?"}</span>
          </span>

          <button
            type="button"
            onClick={() => commit(value + 1)}
            disabled={pending || done}
            aria-label={t("addEpisode")}
            className="size-9 rounded-lg border border-hairline text-muted transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-40"
          >
            +
          </button>
        </div>

        {episodesCount !== null && !done && value > 0 && (
          <button
            type="button"
            onClick={() => commit(episodesCount)}
            disabled={pending}
            className="text-[13px] text-subtle transition-colors hover:text-accent disabled:opacity-40"
          >
            {t("markAll")}
          </button>
        )}

        {episodesCount !== null && episodesCount > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[13px] text-subtle transition-colors hover:text-accent"
          >
            {expanded ? t("hideEpisodes") : t("allEpisodes")}
          </button>
        )}
      </div>

      {expanded && episodesCount !== null && (
        <div>
          <p className="mb-2 text-[12px] text-dim">{t("episodesHint")}</p>
          <div className="flex max-h-[264px] max-w-[560px] flex-wrap gap-1.5 overflow-y-auto pr-1">
            {Array.from({ length: episodesCount }, (_, i) => i + 1).map((n) => {
              const watched = n <= value;
              return (
                <button
                  key={n}
                  type="button"
                  // Клик по последней отмеченной — шаг назад: промахи случаются.
                  onClick={() => commit(n === value ? n - 1 : n)}
                  disabled={pending}
                  aria-pressed={watched}
                  className={`h-9 min-w-9 rounded-lg px-1 font-display text-[12px] font-semibold tabular-nums transition-colors disabled:opacity-40 ${
                    watched
                      ? "bg-accent/90 text-ink hover:bg-accent"
                      : "border border-hairline text-muted hover:border-white/25 hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {episodesCount !== null && episodesCount > 0 && (
        <div className="h-1.5 w-full max-w-[420px] overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.min(100, (value / episodesCount) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
