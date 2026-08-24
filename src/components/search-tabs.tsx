import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Переключатель двух способов искать: по названию (каталог) и по смыслу.
 *
 * Стоит в каталоге, потому что искать человек приходит именно туда. Раньше
 * поиск по смыслу жил ссылкой в верхнем меню, а оно скрыто на телефонах —
 * с мобильного до фичи вёл один путь, мелкая серая подсказка под фильтрами.
 *
 * Запрос переносим между вкладками: набрал название, ничего не нашлось,
 * переключился — и те же слова ищутся по смыслу. Это главный сценарий
 * спасения, ради него вкладки и стоят рядом.
 */
export async function SearchTabs({
  current,
  q = "",
}: {
  current: "name" | "meaning";
  q?: string;
}) {
  const t = await getTranslations("nav");
  const query = q.trim();
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";

  const tabs = [
    { key: "name" as const, href: `/catalog${suffix}`, label: t("byName") },
    { key: "meaning" as const, href: `/search${suffix}`, label: t("byMeaning") },
  ];

  return (
    <div className="flex gap-2" role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
              active
                ? "bg-accent font-semibold text-ink"
                : "border border-hairline bg-white/[0.03] text-muted hover:border-white/20 hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
