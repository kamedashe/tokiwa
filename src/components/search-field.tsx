"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Поле поиска из шапки с выпадающими подсказками.
 *
 * Раньше оно на каждой паузе в наборе делало router.push на каталог. Это
 * полноценный переход: страница перерисовывалась, поле пересоздавалось, фокус
 * улетал — и дописать название было физически нельзя, каждая пауза выбивала
 * клавиатуру. Теперь пока человек печатает, никуда не уходим: показываем
 * список найденного, а переход происходит только по его выбору.
 *
 * Enter без выбранной подсказки уводит в каталог со всем запросом — так
 * работает поиск везде, и ломать эту привычку не за чем.
 */

interface Suggestion {
  slug: string;
  title: string;
  year: number | null;
  format: string | null;
}

const DEBOUNCE_MS = 250;

export function SearchField({ initialQuery = "" }: { initialQuery?: string }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const locale = useLocale();

  const [value, setValue] = useState(initialQuery);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  // -1 значит «ничего не выбрано»: Enter тогда уходит в каталог целиком.
  const [active, setActive] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * На телефоне поле ужимается флексом шапки до сотни пикселей, и список,
   * привязанный к его ширине, названий не вмещает. Поэтому там панель
   * раскладывается по экрану — для этого нужны её координаты.
   */
  const [panel, setPanel] = useState<{ top: number; left: number; width: number } | null>(null);

  // Подсказки за паузу в наборе. Прошлый запрос отменяем: ответы приходят
  // не по порядку, и без этого список мигает результатами старых букв.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}&locale=${locale}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { items?: Suggestion[] } | null) => {
          setItems(data?.items ?? []);
          setActive(-1);
        })
        .catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, locale]);

  // Клик мимо закрывает список, но набранное оставляет.
  useEffect(() => {
    if (!open) return;
    const onOutside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onOutside);
    return () => window.removeEventListener("pointerdown", onOutside);
  }, [open]);

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

  const goToCatalog = () => {
    const q = value.trim();
    setOpen(false);
    router.push(q ? `/catalog?q=${encodeURIComponent(q)}` : "/catalog");
  };

  const goToTitle = (slug: string) => {
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/anime/${slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }

    if (!open || items.length === 0) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // По кругу, и через -1: так стрелками можно вернуться к «искать всё».
      setActive((i) => {
        const next = i + step;
        if (next < -1) return items.length - 1;
        if (next >= items.length) return -1;
        return next;
      });
    }
  };

  const showList = open && items.length > 0;

  // Замеряем поле в момент, когда список показался: открыть поле и получить
  // подсказки — разные события, и привязка к первому оставляла панель
  // непосчитанной, если ответ пришёл позже. Пересчёт на resize; при скролле
  // просто закрываем — шапка не зафиксирована, и панель уехала бы от поля.
  useEffect(() => {
    if (!showList) return;

    const measure = () => {
      const box = rootRef.current?.getBoundingClientRect();
      // На широком экране поля хватает, там панель висит под ним обычным
      // absolute и никаких координат не требует.
      if (window.innerWidth >= 768 || !box) setPanel(null);
      else setPanel({ top: box.bottom + 6, left: 12, width: window.innerWidth - 24 });
    };

    measure();
    const close = () => setOpen(false);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", close, { passive: true });

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", close);
    };
  }, [showList]);

  return (
    <div ref={rootRef} className="relative w-[240px] min-w-0 max-md:w-full max-md:max-w-[220px]">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && items[active]) goToTitle(items[active].slug);
          else goToCatalog();
        }}
        className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/5 px-3.5 py-2.5 transition-colors focus-within:border-accent/50 hover:border-white/20"
      >
        <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden>
          <circle cx="7" cy="7" r="5.2" fill="none" stroke="#6a6a74" strokeWidth="1.5" />
          <path d="M11 11l4 4" stroke="#6a6a74" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          type="search"
          placeholder={t("search")}
          aria-label={t("searchLabel")}
          role="combobox"
          aria-expanded={showList}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          className="w-full bg-transparent text-[13px] text-foreground placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
      </form>

      {showList && (
        <div
          id="search-suggestions"
          role="listbox"
          style={panel ? { position: "fixed", ...panel } : undefined}
          className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-hairline bg-ink/95 py-1.5 shadow-xl backdrop-blur-lg"
        >
          {items.map((item, i) => (
            <button
              key={item.slug}
              type="button"
              role="option"
              aria-selected={i === active}
              // pointerdown, а не click: клик приходит после blur, и список
              // успевает закрыться раньше, чем нажатие до него дойдёт.
              onPointerDown={(e) => {
                e.preventDefault();
                goToTitle(item.slug);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-baseline gap-2 px-3.5 py-2 text-left transition-colors ${
                i === active ? "bg-white/[0.07]" : ""
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {item.title}
              </span>
              <span className="shrink-0 text-[11px] text-dim">
                {[item.format, item.year].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}

          {/* Последней строкой — обычный поиск по каталогу: подсказок семь,
              а совпадений может быть больше. */}
          <button
            type="button"
            role="option"
            aria-selected={active === -1}
            onPointerDown={(e) => {
              e.preventDefault();
              goToCatalog();
            }}
            onMouseEnter={() => setActive(-1)}
            className={`mt-1 flex w-full items-center gap-2 border-t border-hairline px-3.5 py-2 text-left text-[12px] text-muted transition-colors ${
              active === -1 ? "bg-white/[0.07]" : ""
            }`}
          >
            {t("searchAll", { query: value.trim() })}
          </button>
        </div>
      )}
    </div>
  );
}
