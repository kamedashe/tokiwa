import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pickDonateLink } from "@/lib/donate";
import { visitorCountry } from "@/lib/geo";

/**
 * Подвал. Нужен в основном ради ссылки на политику конфиденциальности —
 * Google требует, чтобы она была доступна с сайта, а не только из формы входа.
 *
 * Ссылка на донат появляется сама, если задан DONATE_BOOSTY_URL или
 * DONATE_KOFI_URL — без них здесь просто пусто, ничего не ломается.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const country = await visitorCountry();
  const donate = pickDonateLink(country);

  return (
    <footer className="border-t border-hairline px-4 py-8 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] text-dim">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            {t("privacy")}
          </Link>
          <Link href="/catalog" className="transition-colors hover:text-foreground">
            {nav("catalog")}
          </Link>
          {donate && (
            <a
              href={donate.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-accent"
            >
              <span aria-hidden>♥</span>
              {t("support")}
            </a>
          )}
        </div>

        <p className="max-w-[46ch] leading-relaxed">
          {t("sources")}
        </p>
      </div>
    </footer>
  );
}
