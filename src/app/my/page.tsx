import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { getMyList } from "@/lib/watchlist";
import { STATUS_ORDER, WATCH_STATUSES } from "@/lib/watch-status";

export const metadata = { title: "Мой список" };
export const dynamic = "force-dynamic";

export default async function MyListPage() {
  const grouped = await getMyList();
  if (!grouped) redirect("/login?next=/my");

  const total = STATUS_ORDER.reduce((sum, key) => sum + grouped[key].length, 0);

  if (total === 0) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="flex flex-col items-center gap-4 px-6 py-32 text-center">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Список пуст</h1>
          <p className="max-w-md text-muted">
            Добавляйте тайтлы кнопкой «+ В список» — они появятся здесь, а то, что смотрите сейчас,
            попадёт на главную в ряд «Продолжить просмотр».
          </p>
          <Link
            href="/catalog"
            className="mt-2 rounded-full bg-accent px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-accent-soft"
          >
            В каталог
          </Link>
        </div>
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/my" />
    </main>
    );
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="px-4 pt-8 md:px-10">
        <div className="mb-2 flex items-baseline gap-3">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">Мой список</h1>
          <span className="font-display text-xs tracking-[0.1em] text-dim">{total} тайтлов</span>
        </div>
      </div>

      {STATUS_ORDER.filter((key) => grouped[key].length > 0).map((key) => (
        <TitleGrid
          key={key}
          heading={WATCH_STATUSES[key]}
          subheading={`${grouped[key].length}`}
          items={grouped[key]}
          level={2}
        />
      ))}

      <div className="h-16" />
      <div className="h-20 md:hidden" />
      <MobileNav current="/my" />
    </main>
  );
}
