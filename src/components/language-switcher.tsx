"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_NAMES, LOCALE_SHORT, routing, type Locale } from "@/i18n/routing";

/**
 * Переключатель языка. На десктопе открывается по наведению (group-hover),
 * но hover не существует на тачскринах — там меню держится на explicit-состоянии,
 * которое переключает сам тап по кнопке.
 *
 * Меняем язык через router.replace с той же страницей: пользователь остаётся
 * там, где был, а не улетает на главную.
 */
export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Тап вне меню закрывает его — без этого на телефоне некуда деться,
  // кроме как выбрать язык.
  useEffect(() => {
    if (!open) return;

    const onOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  const select = (code: Locale) => {
    setOpen(false);
    router.replace(pathname, { locale: code });
  };

  return (
    <div ref={rootRef} className="group relative">
      <button
        type="button"
        aria-label={t("switch")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center rounded-full border border-white/[0.08] bg-white/5 px-3 font-display text-[12px] font-semibold tracking-[0.06em] text-muted transition-colors hover:border-white/20 hover:text-foreground"
      >
        {LOCALE_SHORT[locale]}
      </button>

      <div
        className={`absolute right-0 top-full z-50 w-40 pt-2 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          {routing.locales.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => select(code)}
              aria-current={code === locale ? "true" : undefined}
              className={`block w-full px-4 py-2.5 text-left text-[13px] transition-colors ${
                code === locale ? "text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {LOCALE_NAMES[code]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
