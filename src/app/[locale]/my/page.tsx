import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { ImportList } from "@/components/import-list";
import { getMyList } from "@/lib/watchlist";
import { importFromShikimori, importFromMalFile } from "@/lib/import-actions";
import { STATUS_ORDER } from "@/lib/watch-status";

export const dynamic = "force-dynamic";

export default async function MyListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("myList");
  const s = await getTranslations("status");
  const c = await getTranslations("catalog");
  const grouped = await getMyList(locale);
  if (!grouped) redirect("/login?next=/my");

  const total = STATUS_ORDER.reduce((sum, key) => sum + grouped[key].length, 0);

  if (total === 0) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="flex flex-col items-center gap-4 px-6 py-32 text-center">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("emptyTitle")}</h1>
          <p className="max-w-md text-muted">
            {t("emptyText")}
          </p>
          <Link
            href="/catalog"
            className="mt-2 rounded-full bg-accent px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-accent-soft"
          >
            {t("toCatalog")}
          </Link>
        </div>

        <div className="pb-16">
          <ImportList importShikimori={importFromShikimori} importMal={importFromMalFile} />
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
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
          <span className="font-display text-xs tracking-[0.1em] text-dim">
            {c("titlesCount", { count: total })}
          </span>
        </div>
      </div>

      {STATUS_ORDER.filter((key) => grouped[key].length > 0).map((key) => (
        <TitleGrid
          key={key}
          heading={s(key)}
          subheading={`${grouped[key].length}`}
          items={grouped[key]}
          level={2}
          emptyText={c("nothingFound")}
        />
      ))}

      <div className="h-12" />
      <ImportList importShikimori={importFromShikimori} importMal={importFromMalFile} />

      <div className="h-16" />
      <div className="h-20 md:hidden" />
      <MobileNav current="/my" />
    </main>
  );
}
