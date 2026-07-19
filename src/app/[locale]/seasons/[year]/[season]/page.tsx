import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { isSeasonKey, listTitles, seasonLabel } from "@/lib/queries";
import { localeAlternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Отсекаем мусор в адресе до похода в базу. */
function parse(year: string, season: string) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1950 || y > 2100) return null;
  if (!isSeasonKey(season)) return null;
  return { year: y, season };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; season: string; locale: string }>;
}): Promise<Metadata> {
  const { year, season, locale } = await params;
  const parsed = parse(year, season);
  if (!parsed) return {};

  const t = await getTranslations({ locale, namespace: "seasons" });
  return {
    title: seasonLabel(t, parsed.season, parsed.year),
    alternates: { languages: localeAlternates(`/seasons/${year}/${season}`) },
  };
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ year: string; season: string; locale: string }>;
}) {
  const { year, season, locale } = await params;
  const t = await getTranslations("seasons");
  const c = await getTranslations("catalog");

  const parsed = parse(year, season);
  if (!parsed) notFound();

  const items = await listTitles(locale, { season: parsed.season, year: parsed.year }, 100);
  if (items.length === 0) notFound();

  return (
    <main className="min-h-screen">
      <SiteHeader current="/seasons" />

      <div className="px-4 pt-8 md:px-10">
        <Link href="/seasons" className="text-[13px] text-subtle hover:text-foreground">
          {t("allSeasons")}
        </Link>
      </div>

      <TitleGrid
        heading={seasonLabel(t, parsed.season, parsed.year)}
        subheading={c("titlesCount", { count: items.length })}
        items={items}
        emptyText={c("nothingFound")}
      />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/catalog" />
    </main>
  );
}
