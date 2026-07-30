import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MOODS } from "@/lib/moods";

/**
 * Ряд подборок по настроению на главной. Выбирать по жанру и длине умеют
 * все каталоги, а «под состояние души» — нет, хотя решают чаще всего именно
 * так. Заодно это повод зайти, когда считать уже нечего.
 */
export async function MoodStrip() {
  const t = await getTranslations("moods");

  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-10 md:px-10">
      <h2 className="font-display text-[21px] font-semibold tracking-[-0.02em]">{t("title")}</h2>
      <p className="mt-1 text-[13px] text-dim">{t("intro")}</p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {MOODS.map((m) => (
          <Link
            key={m.slug}
            href={`/mood/${m.slug}`}
            className="group rounded-2xl border border-hairline bg-white/[0.02] px-4 py-3.5 transition-colors hover:border-accent/40 hover:bg-accent/[0.05]"
          >
            <div className="font-display text-[15px] font-semibold transition-colors group-hover:text-accent">
              {t(`${m.slug}.name`)}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-dim">{t(`${m.slug}.tagline`)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
