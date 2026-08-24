"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";

/**
 * Поле смыслового поиска.
 *
 * В отличие от поля в шапке здесь нет отправки на паузе: каждый запрос стоит
 * похода в модель за вектором, и дёргать её на каждую букву незачем. Уходим
 * только по Enter или по кнопке.
 *
 * Примеры под полем — не украшение. Главная беда такого поиска в том, что
 * человек видит строку и по привычке пишет туда название, а тогда обычный
 * поиск по каталогу справится лучше. Примеры показывают, о чём вообще можно
 * спрашивать.
 */
export function SemanticSearchField({
  initialQuery = "",
  examples,
}: {
  initialQuery?: string;
  examples: string[];
}) {
  const t = useTranslations("find");
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const go = (q: string) => {
    const trimmed = q.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  };

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/5 px-4 py-3 transition-colors focus-within:border-accent/50 hover:border-white/20"
      >
        <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden>
          <circle cx="7" cy="7" r="5.2" fill="none" stroke="#6a6a74" strokeWidth="1.5" />
          <path d="M11 11l4 4" stroke="#6a6a74" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="search"
          autoFocus={!initialQuery}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          className="w-full bg-transparent text-[15px] text-foreground placeholder:text-faint focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />

        <button
          type="submit"
          className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft"
        >
          {t("submit")}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setValue(example);
              go(example);
            }}
            className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[12px] text-subtle transition-colors hover:border-white/20 hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
