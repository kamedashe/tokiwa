import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { SearchField } from "@/components/search-field";
import { UserMenu } from "@/components/user-menu";
import { LanguageSwitcher } from "@/components/language-switcher";

const NAV = [
  { key: "home", href: "/" },
  { key: "catalog", href: "/catalog" },
  { key: "seasons", href: "/seasons" },
  { key: "top", href: "/top" },
  { key: "myList", href: "/my" },
] as const;

export async function SiteHeader({
  current = "/",
  searchQuery = "",
}: {
  current?: string;
  searchQuery?: string;
}) {
  const t = await getTranslations("nav");

  return (
    <header className="relative z-30 flex items-center justify-between gap-3 px-4 py-4 md:px-10 md:py-6">
      <div className="flex min-w-0 items-center gap-6 md:gap-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo size={26} id="header" />
          {/* На узких экранах логотип сжимается до значка — место нужно поиску. */}
          <span className="font-display text-[19px] font-bold tracking-[-0.03em] max-[420px]:hidden">
            TokiWa<span className="text-accent">.</span>
          </span>
        </Link>

        <nav className="hidden gap-7 text-sm font-medium md:flex">
          {NAV.map((item) => {
            const active = item.href === current;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative pb-1 transition-colors ${
                  active ? "text-foreground" : "text-subtle hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {t(item.key)}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-sm bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none md:gap-3">
        <SearchField initialQuery={searchQuery} />
        <LanguageSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
