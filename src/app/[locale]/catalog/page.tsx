import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { CatalogFilters } from "@/components/catalog-filters";
import { Pagination } from "@/components/pagination";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isSortKey, listGenres, searchTitles, type SortKey } from "@/lib/queries";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("title"), alternates: { languages: localeAlternates("/catalog") } };
}

export default async function CatalogPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ q?: string; genre?: string; sort?: string; page?: string }>;
  params: Promise<{ locale: string }>;
}) {
  const [sp, { locale }] = await Promise.all([searchParams, params]);
  const t = await getTranslations("catalog");

  const q = sp.q?.trim() || undefined;
  const genre = sp.genre?.trim() || undefined;
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : "score";
  const page = Math.max(1, Number(sp.page) || 1);

  const [result, genres] = await Promise.all([
    searchTitles({ locale, q, genre, sort, page }),
    listGenres(),
  ]);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (genre) params.set("genre", genre);
    if (sort !== "score") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  };

  const subheading = q
    ? t("found", { query: q, count: result.total })
    : t("titlesCount", { count: result.total });

  return (
    <main className="min-h-screen">
      <SiteHeader current="/catalog" searchQuery={q ?? ""} />

      <div className="px-4 pt-8 md:px-10">
        <div className="mb-7 flex items-baseline gap-3">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
          <span className="font-display text-xs tracking-[0.1em] text-dim">{subheading}</span>
        </div>

        <CatalogFilters genres={genres} q={q} genre={genre} sort={sort} />
      </div>

      <TitleGrid items={result.items} emptyText={t("nothingFound")} />

      <div className="px-4 pb-16 md:px-10">
        <Pagination page={result.page} pages={result.pages} hrefFor={hrefFor} />
      </div>
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/catalog" />
    </main>
  );
}
