import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { MarkUpdatesSeen } from "@/components/updates-bell";
import { CHANGELOG, LATEST_UPDATE, changelogLocale } from "@/lib/changelog";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "updates" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { languages: localeAlternates("/updates") },
  };
}

export default async function UpdatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("updates");
  const lang = changelogLocale(locale);

  const formatDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });

  return (
    <main className="min-h-screen">
      <MarkUpdatesSeen latest={LATEST_UPDATE} />
      <SiteHeader />

      <div className="mx-auto max-w-[720px] px-4 py-8 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mt-2 text-[15px] text-muted">{t("intro")}</p>

        <div className="mt-8 flex flex-col gap-4">
          {CHANGELOG.map((entry, i) => (
            <article
              key={`${entry.date}-${i}`}
              className="rounded-2xl border border-hairline bg-white/[0.02] p-5"
            >
              <div className="font-display text-[11px] tracking-[0.14em] text-dim">
                {formatDate.format(new Date(entry.date)).toUpperCase()}
              </div>
              <h2 className="mt-2 font-display text-[17px] font-semibold tracking-[-0.01em]">
                {entry[lang].title}
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{entry[lang].text}</p>
              {entry.href && (
                <Link
                  href={entry.href}
                  className="mt-3 inline-block text-[13px] font-semibold text-accent transition-colors hover:text-accent-soft"
                >
                  {t("try")} →
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="h-16" />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}
