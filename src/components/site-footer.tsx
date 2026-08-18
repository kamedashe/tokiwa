import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TelegramIcon } from "@/components/telegram-icon";
import { TELEGRAM_URL } from "@/lib/seo";

/**
 * Подвал. Нужен в основном ради ссылки на политику конфиденциальности —
 * Google требует, чтобы она была доступна с сайта, а не только из формы входа.
 *
 * Страну посетителя здесь больше не определяем: чтение заголовков запроса
 * делало динамической каждую страницу сайта, ведь подвал есть везде. Ссылка
 * ведёт на /support, а нужную платёжку выбирает уже она.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const upd = await getTranslations("updates");

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
          <Link href="/friends" className="transition-colors hover:text-foreground">
            {t("friends")}
          </Link>
          <Link href="/updates" className="transition-colors hover:text-foreground">
            {upd("title")}
          </Link>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-[#2AABEE]"
          >
            <TelegramIcon className="size-3.5" />
            Telegram
          </a>
          {/* Ведём на свою страницу, а не сразу на платёжку: там объяснено,
              за что просим и что получают поддержавшие. */}
          <Link
            href="/support"
            className="flex items-center gap-1.5 transition-colors hover:text-accent"
          >
            <span aria-hidden>♥</span>
            {t("support")}
          </Link>
        </div>

        <p className="max-w-[46ch] leading-relaxed">
          {t("sources")}
        </p>
      </div>
    </footer>
  );
}
