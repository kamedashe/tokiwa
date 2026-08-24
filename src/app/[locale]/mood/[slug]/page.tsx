import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { AnimeCard } from "@/components/anime-card";
import { MOODS, moodBySlug } from "@/lib/moods";
import { listByMood } from "@/lib/queries";
import { localeAlternates, ogImage } from "@/lib/seo";

/** Подборки статичны по составу настроений — генерируем все на сборке. */
export function generateStaticParams() {
  return MOODS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  if (!moodBySlug(slug)) return {};

  const t = await getTranslations({ locale, namespace: "moods" });
  return {
    title: t(`${slug}.name`),
    description: t(`${slug}.tagline`),
    alternates: { languages: localeAlternates(`/mood/${slug}`) },
    openGraph: {
      images: [ogImage({ title: t(`${slug}.name`), subtitle: t(`${slug}.tagline`) })],
    },
  };
}

export default async function MoodPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const mood = moodBySlug(slug);
  if (!mood) notFound();

  const t = await getTranslations("moods");
  const items = await listByMood(mood, locale);

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">
          {t(`${slug}.name`)}
        </h1>
        <p className="mt-2 max-w-[60ch] text-[15px] text-muted">{t(`${slug}.tagline`)}</p>

        {/* Соседние настроения рядом: под настроение выбирают перебором. */}
        <div className="mt-6 flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <Link
              key={m.slug}
              href={`/mood/${m.slug}`}
              className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                m.slug === slug
                  ? "bg-accent font-semibold text-ink"
                  : "border border-hairline bg-white/[0.03] text-muted hover:border-white/20 hover:text-foreground"
              }`}
            >
              {t(`${m.slug}.name`)}
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <p className="mt-16 text-center text-muted">{t("empty")}</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-[18px]">
            {items.map((item, i) => (
              <AnimeCard key={item.id} item={item} deg={150 + (i % 8) * 6} />
            ))}
          </div>
        )}
      </div>

      <div className="h-16" />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}
