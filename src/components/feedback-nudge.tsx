"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

const DISMISS_KEY = "tokiwa-feedback-nudge-dismissed";

/**
 * Мягкий призыв оставить отзыв. Показывается активным пользователям (страницы
 * списка и бэклога — туда доходят только те, кто реально пользуется сайтом).
 * Крестик прячет навсегда через localStorage — надоедать дважды хуже, чем
 * не спросить вовсе.
 */
export function FeedbackNudge({
  labels,
}: {
  labels: { title: string; text: string; cta: string; close: string };
}) {
  // До маунта не рендерим ничего: localStorage на сервере нет, а мигающий
  // и исчезающий блок выглядит хуже, чем блок, появившийся на долю позже.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISS_KEY)) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative rounded-2xl border border-hairline bg-white/[0.02] px-5 py-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label={labels.close}
        className="absolute right-3 top-3 px-1 text-[15px] leading-none text-dim transition-colors hover:text-foreground"
      >
        ×
      </button>

      <div className="font-display text-[14px] font-semibold">{labels.title}</div>
      <p className="mt-1 max-w-[52ch] text-[13px] text-muted">{labels.text}</p>
      <Link
        href="/feedback"
        className="mt-3 inline-block rounded-full border border-accent/40 px-4 py-1.5 text-[13px] text-accent transition-colors hover:border-accent hover:text-accent-soft"
      >
        {labels.cta} →
      </Link>
    </div>
  );
}
