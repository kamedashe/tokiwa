import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { SemanticSearchField } from "@/components/semantic-search-field";
import { SearchTabs } from "@/components/search-tabs";
import { semanticSearch } from "@/lib/semantic-queries";
import { localeAlternates, ogImage } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "find" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: { languages: localeAlternates("/search") },
    // В подписи — живой пример запроса, а не описание: карточка объясняет
    // фичу быстрее любого пересказа, а описание туда всё равно не влезает.
    openGraph: { images: [ogImage({ title: t("title"), subtitle: t("example2") })] },
  };
}

export default async function SearchPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ q?: string }>;
  params: Promise<{ locale: string }>;
}) {
  const [sp, { locale }] = await Promise.all([searchParams, params]);
  const t = await getTranslations("find");

  const q = sp.q?.trim() ?? "";
  const result = q ? await semanticSearch(q, locale) : null;

  const examples = [t("example1"), t("example2"), t("example3"), t("example4")];

  return (
    <main className="min-h-screen">
      <SiteHeader current="/search" />

      <div className="px-4 pt-8 md:px-10">
        <div className="max-w-[720px]">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-subtle">{t("lead")}</p>

          <div className="mt-5">
            <SearchTabs current="meaning" q={q} />
          </div>

          <div className="mt-6">
            <SemanticSearchField initialQuery={q} examples={examples} />
          </div>

          {/* Что из запроса поняли как условие. Без этого выдача выглядит
              своевольной: человек не видит, что «без гарема» и «2020-х»
              сработали, и решает, что поиск их проигнорировал. */}
          {result && result.matched.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="font-display text-xs tracking-[0.1em] text-dim">
                {t("conditions")}
              </span>
              {result.matched.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-accent/30 bg-accent/[0.06] px-3 py-1 text-[12px] text-muted"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {result?.unavailable ? (
        <div className="px-4 pb-8 pt-12 md:px-10">
          <p className="max-w-[560px] text-[14px] leading-relaxed text-muted">{t("unavailable")}</p>
        </div>
      ) : result ? (
        <div className="pt-8">
          <TitleGrid items={result.items} emptyText={t("nothing")} />
        </div>
      ) : (
        <div className="px-4 pb-8 pt-12 md:px-10">
          <p className="max-w-[560px] text-[14px] leading-relaxed text-faint">{t("hint")}</p>
        </div>
      )}

      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/search" />
    </main>
  );
}
