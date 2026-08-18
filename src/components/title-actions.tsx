"use client";

import { useEffect, useState } from "react";
import { getEntry } from "@/lib/watchlist";
import { WatchlistButton } from "@/components/watchlist-button";
import { StatusPicker } from "@/components/status-picker";
import { ProgressStepper } from "@/components/progress-stepper";

/**
 * Личное состояние тайтла (в списке ли он, какой статус, сколько серий
 * отмечено), узнаваемое уже в браузере.
 *
 * Раньше статус читался на сервере, из-за чего каждая из пятнадцати тысяч
 * страниц — да ещё на четырёх языках — рендерилась заново на каждый запрос.
 * Обход робота по такому каталогу означает шестьдесят тысяч обращений к базе;
 * один такой обход сжёг месячную квоту. Теперь страница отдаётся из кэша, а
 * личное подтягивается отдельно: роботы этого не делают, они не исполняют
 * скрипты.
 *
 * Блоков два, они стоят в разных местах вёрстки, поэтому каждый спрашивает
 * состояние сам — запрос лёгкий, ходит по индексу.
 */
function useEntry(titleId: number) {
  const [entry, setEntry] = useState<{ status: string; progress: number } | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;

    getEntry(titleId)
      .then((data) => !cancelled && setEntry(data))
      .catch(() => !cancelled && setEntry(null));

    return () => {
      cancelled = true;
    };
  }, [titleId]);

  return entry;
}

/** Кнопка «в список» и выбор статуса — колонка с постером. */
export function TitleListActions({ titleId }: { titleId: number }) {
  const entry = useEntry(titleId);

  return (
    // Пока состояние неизвестно, блок приглушён, но место уже занимает —
    // иначе вёрстка подпрыгивает, когда ответ приходит.
    <div className={`mt-5 flex flex-col gap-3 ${entry === undefined ? "opacity-50" : ""}`}>
      <WatchlistButton
        key={`w-${entry?.status ?? "none"}`}
        titleId={titleId}
        initialInList={Boolean(entry)}
        className="w-full !py-2.5 !text-[14px]"
      />
      <StatusPicker
        key={`s-${entry?.status ?? "none"}`}
        titleId={titleId}
        initialStatus={entry?.status ?? null}
      />
    </div>
  );
}

/** Счётчик просмотренных серий — основная колонка. */
export function TitleProgress({
  titleId,
  episodesCount,
}: {
  titleId: number;
  episodesCount: number | null;
}) {
  const entry = useEntry(titleId);

  return (
    <div className={entry === undefined ? "opacity-50" : ""}>
      <ProgressStepper
        key={`p-${entry?.progress ?? 0}`}
        titleId={titleId}
        initialProgress={entry?.progress ?? 0}
        episodesCount={episodesCount}
      />
    </div>
  );
}
