import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { TitleGrid } from "@/components/title-grid";
import { isSeasonKey, listTitles, seasonLabel } from "@/lib/queries";

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
  params: Promise<{ year: string; season: string }>;
}): Promise<Metadata> {
  const { year, season } = await params;
  const parsed = parse(year, season);
  if (!parsed) return { title: "Сезон не найден" };

  return { title: seasonLabel(parsed.season, parsed.year) };
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ year: string; season: string }>;
}) {
  const { year, season } = await params;

  const parsed = parse(year, season);
  if (!parsed) notFound();

  const items = await listTitles({ season: parsed.season, year: parsed.year }, 100);
  if (items.length === 0) notFound();

  return (
    <main className="min-h-screen">
      <SiteHeader current="/seasons" />

      <div className="px-4 pt-8 md:px-10">
        <Link href="/seasons" className="text-[13px] text-subtle hover:text-foreground">
          ← Все сезоны
        </Link>
      </div>

      <TitleGrid
        heading={seasonLabel(parsed.season, parsed.year)}
        subheading={`${items.length} тайтлов`}
        items={items}
      />
      <div className="h-20 md:hidden" />
      <MobileNav current="/catalog" />
    </main>
  );
}
