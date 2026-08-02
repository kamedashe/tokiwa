"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

const SEEN_KEY = "tokiwa-updates-seen";

/**
 * Значок «Что нового» в шапке. Точка загорается, когда свежайшая запись
 * журнала новее последнего визита на /updates — метка визита лежит в
 * localStorage, поэтому индикатор свой у каждого браузера и ничего не
 * стоит серверу.
 */
export function UpdatesBell({ latest, label }: { latest: string; label: string }) {
  // До гидрации точку не показываем: localStorage на сервере недоступен,
  // и мигание «точка есть — точки нет» выглядит хуже её задержки.
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    setUnseen(!seen || seen < latest);
  }, [latest]);

  return (
    <Link
      href="/updates"
      aria-label={label}
      title={label}
      className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-hairline text-subtle transition-colors hover:border-accent/50 hover:text-accent"
    >
      {/* Искра, а не колокольчик: колокольчик обещает уведомления лично вам,
          а тут новости продукта. */}
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-[17px]" aria-hidden>
        <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
        <path d="M19 15l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6-2.6-.9 2.6-.9L19 15z" opacity=".7" />
      </svg>
      {unseen && (
        <span className="absolute right-1 top-1 size-2 rounded-full bg-accent ring-2 ring-ink" />
      )}
    </Link>
  );
}

/** Ставится на странице /updates: погасить точку — значит записать визит. */
export function MarkUpdatesSeen({ latest }: { latest: string }) {
  useEffect(() => {
    localStorage.setItem(SEEN_KEY, latest);
  }, [latest]);
  return null;
}
