import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { Hero } from "@/components/hero";
import { CardRow } from "@/components/card-row";
import { getHero, getHomeRows } from "@/lib/queries";
import { getContinueWatching } from "@/lib/watchlist";

// Страница персональная (шапка с профилем + «Продолжить просмотр»),
// поэтому рендерится на каждый запрос, а не отдаётся статикой.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const hero = await getHero();
  const [rows, continueWatching] = await Promise.all([
    getHomeRows(hero?.id),
    getContinueWatching(),
  ]);

  if (!hero) return <EmptyState />;

  // Ряд из макета: у гостя и у пустого списка его просто нет.
  const allRows =
    continueWatching.length > 0
      ? [
          {
            title: "Продолжить просмотр",
            count: "ваш список",
            href: "/my",
            items: continueWatching,
          },
          ...rows,
        ]
      : rows;

  return (
    <main className="min-h-screen">
      <SiteHeader current="/" />
      <Hero item={hero} />
      {allRows.map((row, i) => (
        <CardRow key={row.title} row={row} index={i} />
      ))}
      <div className="h-12" />
      <div className="h-20 md:hidden" />
      <MobileNav current="/" />
    </main>
  );
}

/** Каталог ещё не наполнен — подсказываем, что запустить. */
function EmptyState() {
  return (
    <main className="min-h-screen">
      <SiteHeader current="/" />
      <div className="flex flex-col items-center gap-4 px-6 py-32 text-center">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Каталог пуст</h1>
        <p className="max-w-md text-muted">
          Метаданные ещё не загружены. Выполните{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-accent">npm run db:seed</code> — он
          заберёт тайтлы из Jikan и сложит их в базу.
        </p>
        <Link href="/" className="text-sm text-accent hover:text-accent-soft">
          Обновить
        </Link>
      </div>
      <div className="h-20 md:hidden" />
      <MobileNav current="/" />
    </main>
  );
}
