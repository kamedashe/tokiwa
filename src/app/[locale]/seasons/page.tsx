import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { SEASON_KEYS, currentSeason, listSeasons, listTitles, seasonLabel } from "@/lib/queries";
import { localeAlternates } from "@/lib/seo";

// Публичная страница, одинаковая для всех: отдаётся из кэша, чтобы
// обходы роботов не били в базу. Обновляется раз в час.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("seasons"), alternates: { languages: localeAlternates("/seasons") } };
}

export default async function SeasonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("seasons");
  const c = await getTranslations("catalog");
  const season = currentSeason();

  const [items, seasons] = await Promise.all([
    listTitles(locale, { season: season.key, year: season.year }),
    listSeasons(),
  ]);

  // Текущий сезон уже показан сеткой ниже — в списке ссылок он не нужен.
  const others = seasons.filter((s) => !(s.year === season.year && s.season === season.key));

  // Плоская россыпь из трёх сотен плашек нечитаема — группируем по годам:
  // строка на год, внутри сезоны в календарном порядке.
  const byYear = new Map<number, typeof others>();
  for (const s of others) {
    const bucket = byYear.get(s.year) ?? [];
    bucket.push(s);
    byYear.set(s.year, bucket);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const seasonOrder = (key: string) => SEASON_KEYS.indexOf(key as never);

  return (
    <main className="min-h-screen">
      <SiteHeader current="/seasons" />

      <div className="px-4 pt-8 md:px-10">
        <div className="mb-5 flex items-baseline gap-3">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">
            {seasonLabel(t, season.key, season.year)}
          </h1>
          <span className="font-display text-xs tracking-[0.1em] text-dim">{t("current")}</span>
        </div>

        {years.length > 0 && (
          <div className="mb-2">
            <div className="mb-3 font-display text-[11px] tracking-[0.16em] text-dim">
              {t("others")}
            </div>
            <div className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-2 md:max-h-[340px]">
              {years.map((year) => (
                <div key={year} className="flex items-baseline gap-3">
                  <span className="w-11 shrink-0 text-right font-display text-[13px] font-semibold tabular-nums text-subtle">
                    {year}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {byYear
                      .get(year)!
                      .sort((a, b) => seasonOrder(a.season) - seasonOrder(b.season))
                      .map((s) => (
                        <Link
                          key={s.season}
                          href={`/seasons/${s.year}/${s.season}`}
                          className="rounded-full border border-hairline bg-white/[0.03] px-3 py-1 text-[12px] text-muted transition-colors hover:border-white/20 hover:text-foreground"
                        >
                          {t(s.season)}
                          <span className="ml-1.5 text-[10px] opacity-60">{s.count}</span>
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <TitleGrid items={items} emptyText={c("nothingFound")} />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/catalog" />
    </main>
  );
}
