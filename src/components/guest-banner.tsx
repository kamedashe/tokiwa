import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Напоминание гостю, что его список привязан к куке браузера, а не к
 * аккаунту. Это единственное место, где сайт просит регистрацию: не ради
 * доступа к функциям, а чтобы не потерять уже накопленное.
 */
export async function GuestBanner({ next }: { next: string }) {
  const t = await getTranslations("guest");

  return (
    <div className="mt-6 flex max-w-[720px] flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-accent/25 bg-accent/[0.05] px-5 py-4">
      <div className="min-w-[220px] flex-1">
        <div className="font-display text-[14px] font-semibold">{t("saveTitle")}</div>
        <p className="mt-1 text-[13px] text-muted">{t("saveText")}</p>
      </div>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="rounded-full bg-accent px-5 py-2.5 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft"
      >
        {t("saveCta")}
      </Link>
    </div>
  );
}
