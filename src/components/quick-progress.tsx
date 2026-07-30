"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setProgress } from "@/lib/watchlist";

/**
 * «+1» прямо на карточке — главный жест трекера.
 *
 * Раньше отметить серию значило найти тайтл, открыть его страницу и только
 * там нажать кнопку: три-четыре шага и две загрузки. Из-за этого прогресс
 * отмечали на других сайтах, а сюда заходили только посчитать часы.
 *
 * Кнопка живёт поверх карточки-ссылки, поэтому клик по ней гасим — иначе
 * заодно откроется страница тайтла. Значение меняем сразу, не дожидаясь
 * сервера: жест должен ощущаться мгновенным.
 */
export function QuickProgress({
  titleId,
  progress,
  episodesCount,
  label,
}: {
  titleId: number;
  progress: number;
  episodesCount: number | null;
  /** Подпись для скринридера — на кнопке только «+1». */
  label: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(progress);
  const [pending, startTransition] = useTransition();

  const done = episodesCount !== null && value >= episodesCount;
  const percent = episodesCount ? Math.min(100, (value / episodesCount) * 100) : 0;

  const bump = (event: React.MouseEvent) => {
    // Карточка целиком — ссылка, и без этого клик уводит на страницу тайтла.
    event.preventDefault();
    event.stopPropagation();
    if (done || pending) return;

    const next = value + 1;
    const previous = value;
    setValue(next);

    startTransition(async () => {
      const result = await setProgress(titleId, next);
      if (!result.ok) {
        setValue(previous);
        return;
      }
      // Тихо обновляем страницу: часы в «сколько у меня времени» и ряды
      // на главной должны сойтись с новой отметкой.
      router.refresh();
    });
  };

  return (
    <>
      {/* Правый верх — единственный угол, свободный от рейтинга и названия. */}
      {!done && (
        <button
          type="button"
          onClick={bump}
          disabled={pending}
          aria-label={label}
          className="absolute right-2.5 top-2.5 z-10 flex size-8 items-center justify-center rounded-full bg-accent/95 font-display text-[12px] font-bold text-ink shadow-lg backdrop-blur-[6px] transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
        >
          +1
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-white/[0.08]">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Счётчик у самого низа: видно, сколько осталось, не открывая тайтл. */}
      <div className="absolute bottom-1.5 right-2.5 z-10 font-display text-[10px] font-semibold tabular-nums text-muted-2">
        {value}
        <span className="text-dim">/{episodesCount ?? "?"}</span>
      </div>
    </>
  );
}
