"use client";

import { useEffect, useState } from "react";
import { getEntry } from "@/lib/watchlist";
import { WatchlistButton } from "@/components/watchlist-button";
import { StatusPicker } from "@/components/status-picker";
import { ProgressStepper } from "@/components/progress-stepper";
import { EpisodeNotifyAsk } from "@/components/episode-notify-ask";
import { ENTRY_CHANGED, type EntryChangedDetail } from "@/lib/entry-events";

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

    // Соседний блок мог поменять запись — например, статус «посмотрел»
    // проставляет полный прогресс. Подхватываем, не дожидаясь перезагрузки.
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<EntryChangedDetail>).detail;
      if (detail?.titleId !== titleId) return;
      setEntry((prev) => ({ status: prev?.status ?? "completed", progress: detail.progress }));
    };

    window.addEventListener(ENTRY_CHANGED, onChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(ENTRY_CHANGED, onChanged);
    };
  }, [titleId]);

  return entry;
}

/** Кнопка «в список» и выбор статуса — колонка с постером. */
export function TitleListActions({
  titleId,
  releasing,
  nextEpisodeAt,
  vapidKey,
}: {
  titleId: number;
  /** Тайтл ещё выходит — только тогда есть смысл в уведомлениях. */
  releasing: boolean;
  nextEpisodeAt: string | null;
  /** Пустая строка означает, что пуши в окружении не настроены. */
  vapidKey: string;
}) {
  const entry = useEntry(titleId);

  // Статус нужен и здесь: просьба про уведомления показывается ровно тем,
  // у кого этот тайтл в «смотрю». Локальное состояние опережает сервер,
  // чтобы плашка появлялась в тот же момент, что и нажатие.
  const [picked, setPicked] = useState<string | null>(null);
  const status = picked ?? entry?.status ?? null;

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
        onPicked={setPicked}
      />

      {/* Единственный канал возврата, которому хватает одного тайтла в
          списке, — и единственный, не требующий регистрации. */}
      {vapidKey && releasing && status === "watching" && (
        <EpisodeNotifyAsk vapidKey={vapidKey} nextEpisodeAt={nextEpisodeAt} />
      )}
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
