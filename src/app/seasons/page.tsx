import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { TitleGrid } from "@/components/title-grid";
import { currentSeason, listSeasons, listTitles } from "@/lib/queries";

export const metadata = { title: "Сезоны" };
// Шапка показывает профиль текущего пользователя.
export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  const season = currentSeason();

  const [items, seasons] = await Promise.all([
    listTitles({ season: season.key, year: season.year }),
    listSeasons(),
  ]);

  // Текущий сезон уже показан сеткой ниже — в списке ссылок он не нужен.
  const others = seasons.filter((s) => !(s.year === season.year && s.season === season.key));

  return (
    <main className="min-h-screen">
      <SiteHeader current="/seasons" />

      <div className="px-4 pt-8 md:px-10">
        <div className="mb-5 flex items-baseline gap-3">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">
            Сезон · {season.label}
          </h1>
          <span className="font-display text-xs tracking-[0.1em] text-dim">текущий</span>
        </div>

        {others.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="mr-1 font-display text-[11px] tracking-[0.16em] text-dim">
              ДРУГИЕ СЕЗОНЫ
            </span>
            {others.map((s) => (
              <Link
                key={`${s.year}-${s.season}`}
                href={`/seasons/${s.year}/${s.season}`}
                className="rounded-full border border-hairline bg-white/[0.03] px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-white/20 hover:text-foreground"
              >
                {s.label}
                <span className="ml-1.5 text-[10px] opacity-60">{s.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <TitleGrid items={items} />
      <div className="h-20 md:hidden" />
      <MobileNav current="/catalog" />
    </main>
  );
}
