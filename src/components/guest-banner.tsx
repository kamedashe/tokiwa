import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { formatDuration } from "@/lib/backlog";

/**
 * Предложение гостю завести аккаунт. Продаём не страховку от потери куки,
 * а пользу прямо сейчас: список на всех устройствах и письма о сериях —
 * страх гипотетической потери люди откладывают «на потом», а телефон у
 * каждого в руке уже сегодня.
 *
 * OAuth стартует прямо из баннера: каждый лишний экран на пути к входу
 * режет прохождение примерно вдвое, поэтому страницы логина в этой воронке
 * больше нет. Когда в списке от пяти тайтлов, заголовок называет накопленное
 * ("47 тайтлов и 312 часов — только в этом браузере") — цену видно сразу.
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

      <div className="flex flex-col items-center gap-1.5">
        <GoogleSignInButton next={next} label={t("googleCta")} />
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="text-[11px] text-dim transition-colors hover:text-foreground"
        >
          {t("otherWays")}
        </Link>
      </div>
    </div>
  );
}
