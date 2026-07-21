"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

/**
 * Выпадающее меню профиля. Раньше аватар был прямой ссылкой на /my, а сам
 * список (бэклог, админка, выход) открывался только по group-hover — на
 * тачскрине hover не бывает, поэтому на телефоне эти пункты были недостижимы
 * в принципе. Теперь аватар — кнопка-переключатель, «Мой список» переехал
 * первым пунктом меню.
 */
export function UserMenuDropdown({
  name,
  image,
  donateUrl,
  labels,
  signOutAction,
}: {
  name: string | null | undefined;
  image: string | null | undefined;
  donateUrl: string | null;
  labels: {
    myList: string;
    backlog: string;
    support: string;
    signOut: string;
  };
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="group relative">
      <button
        type="button"
        aria-label={labels.myList}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="block"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? labels.myList}
            width={36}
            height={36}
            className="size-9 rounded-full border border-white/10 object-cover"
          />
        ) : (
          <div className="size-9 rounded-full border border-white/10 bg-[linear-gradient(135deg,#2a2a34,#14141a)]" />
        )}
      </button>

      <div
        className={`absolute right-0 top-full z-50 w-44 pt-2 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          {name && (
            <div className="truncate border-b border-hairline px-4 py-3 text-[13px] text-muted">
              {name}
            </div>
          )}

          <Link
            href="/my"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-[13px] text-muted hover:text-foreground"
          >
            {labels.myList}
          </Link>

          <Link
            href="/backlog"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-[13px] text-muted hover:text-foreground"
          >
            {labels.backlog}
          </Link>

          {donateUrl && (
            <a
              href={donateUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-[13px] text-accent hover:text-accent-soft"
            >
              ♥ {labels.support}
            </a>
          )}

          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full px-4 py-2.5 text-left text-[13px] text-muted hover:text-foreground"
            >
              {labels.signOut}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
