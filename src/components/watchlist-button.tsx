"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleWatchlist } from "@/lib/watchlist";

/**
 * «+ В список» / «✓ В списке». Гостя уводим на логин, а не молча проглатываем
 * клик. Состояние обновляем оптимистично — сервер всё равно вернёт правду.
 */
export function WatchlistButton({
  titleId,
  initialInList,
  className = "",
}: {
  titleId: number;
  initialInList: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [inList, setInList] = useState(initialInList);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const next = !inList;
    setInList(next);

    startTransition(async () => {
      const result = await toggleWatchlist(titleId);

      if (!result.ok) {
        setInList(!next); // откатываем
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      setInList(result.inList);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={inList}
      className={`rounded-full border px-6 py-3 text-[15px] font-semibold transition-colors disabled:opacity-60 ${
        inList
          ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
          : "border-hairline-strong text-foreground hover:border-white/35"
      } ${className}`}
    >
      {inList ? "✓ В списке" : "+ В список"}
    </button>
  );
}
