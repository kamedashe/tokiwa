import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDuration } from "@/lib/backlog";

/**
 * Напоминание гостю, что его список привязан к куке браузера, а не к
 * аккаунту. Это единственное место, где сайт просит регистрацию: не ради
 * доступа к функциям, а чтобы не потерять уже накопленное.
 *
 * Когда известно, сколько накоплено, говорим прямо: «47 тайтлов и 312 часов
 * пропадут». Общее предупреждение люди пролистывают, названная цена потери —
 * нет. Пока в списке пара тайтлов, теряться нечему, и текст остаётся мягким.
 */
export async function GuestBanner({
  next,
  weight,
}: {
  next: string;
  weight?: { titles: number; minutes: number };
}) {
  const t = await getTranslations("guest");
  const time = await getTranslations("time");

  // Порог: ниже него список ещё не жалко, и настойчивость только раздражает.
  const heavy = weight !== undefined && weight.titles >= 5;

  return (
    <div className="mt-6 flex max-w-[720px] flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-accent/25 bg-accent/[0.05] px-5 py-4">
      <div className="min-w-[220px] flex-1">
        <div className="font-display text-[14px] font-semibold">
          {heavy
            ? t("weightTitle", {
                titles: weight.titles,
                time: formatDuration(time, weight.minutes),
              })
            : t("saveTitle")}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {heavy ? t("weightText") : t("saveText")}
        </p>
      </div>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="rounded-full bg-accent px-5 py-2.5 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft"
      >
        {heavy ? t("weightCta") : t("saveCta")}
      </Link>
    </div>
  );
}
