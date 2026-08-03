"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setStatus } from "@/lib/watchlist";

/**
 * «→ Смотрю» в блоке «Начали выходить»: один клик переводит запланированный
 * тайтл в текущий просмотр. Важно не только удобством — попав в «смотрю»,
 * тайтл начинает присылать уведомления о сериях, то есть человек сам
 * подключает себе причину возвращаться.
 */
export function StartWatchingButton({ titleId, label }: { titleId: number; label: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const result = await setStatus(titleId, "watching");
      if (result.ok) {
        setDone(true);
        router.refresh();
      }
    });
  };

  if (done) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-full border border-accent/40 px-2.5 py-0.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
