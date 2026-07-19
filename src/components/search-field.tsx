"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Поле поиска из шапки. Отправляет на /catalog?q=…
 * Пока пользователь печатает, ждём паузу — иначе роутер дёргается на каждую
 * букву. По Enter уходим сразу, не дожидаясь дебаунса.
 */
export function SearchField({ initialQuery = "" }: { initialQuery?: string }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  // Не редиректим при первом рендере — иначе страница каталога сама себя
  // перезагрузит на маунте.
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;

    const t = setTimeout(() => {
      const q = value.trim();
      router.push(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
    }, 350);

    return () => clearTimeout(t);
  }, [value, router]);

  // «/» фокусирует поиск — привычно по любому каталогу.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
      }}
      className="flex w-[240px] min-w-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/5 px-3.5 py-2.5 transition-colors focus-within:border-accent/50 hover:border-white/20 max-md:w-full max-md:max-w-[220px]"
    >
      <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden>
        <circle cx="7" cy="7" r="5.2" fill="none" stroke="#6a6a74" strokeWidth="1.5" />
        <path d="M11 11l4 4" stroke="#6a6a74" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          dirty.current = true;
          setValue(e.target.value);
        }}
        type="search"
        placeholder={t("search")}
        aria-label={t("searchLabel")}
        className="w-full bg-transparent text-[13px] text-foreground placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
    </form>
  );
}
