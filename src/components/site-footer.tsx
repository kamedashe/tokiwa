import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Подвал. Нужен в основном ради ссылки на политику конфиденциальности —
 * Google требует, чтобы она была доступна с сайта, а не только из формы входа.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");

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
        </div>

        <p className="max-w-[46ch] leading-relaxed">
          {t("sources")}
        </p>
      </div>
    </footer>
  );
}
