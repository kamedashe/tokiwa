import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Нижняя панель вместо гамбургера: трекером пользуются одной рукой, и до
 * низа экрана большой палец дотягивается, а до верхнего угла — нет.
 * На десктопе не показывается, там обычное меню в шапке.
 */
const ITEMS = [
  { href: "/", key: "home", icon: HomeIcon },
  { href: "/catalog", key: "catalog", icon: SearchIcon },
  { href: "/my", key: "myList", icon: ListIcon },
  { href: "/backlog", key: "time", icon: ClockIcon },
] as const;

export async function MobileNav({ current = "/" }: { current?: string }) {
  const t = await getTranslations("nav");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-ink/95 backdrop-blur-lg md:hidden"
      // Учитываем «шторку» айфонов, иначе панель налезает на системную полоску.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={t("mainNav")}
    >
      <div className="flex">
        {ITEMS.map((item) => {
          const active = item.href === current;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors ${
                active ? "text-accent" : "text-subtle"
              }`}
            >
              <Icon />
              <span className="text-[10px] leading-none">{t(item.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const ICON = {
  className: "size-5",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function HomeIcon() {
  return (
    <svg {...ICON}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...ICON}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg {...ICON}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
