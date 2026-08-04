import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { prisma } from "@/lib/prisma";
import { pickDonateLink } from "@/lib/donate";
import { visitorCountry } from "@/lib/geo";
import { localeAlternates } from "@/lib/seo";

// Ссылка на донат зависит от страны посетителя.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "support" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { languages: localeAlternates("/support") },
  };
}

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("support");

  const [donate, supporters] = await Promise.all([
    visitorCountry().then(pickDonateLink),
    // Показываем только тех, кто разрешил назвать себя.
    prisma.user.findMany({
      where: { isSupporter: true, supporterName: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true, supporterName: true },
    }),
  ]);

  const perks = [t("perk1"), t("perk2"), t("perk3"), t("perk4")];

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-[720px] px-4 py-8 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{t("intro")}</p>

        <section className="mt-8 rounded-2xl border border-hairline bg-white/[0.02] p-5">
          <h2 className="font-display text-[15px] font-semibold">{t("whyTitle")}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">{t("why")}</p>
        </section>

        <section className="mt-4 rounded-2xl border border-accent/25 bg-accent/[0.05] p-5">
          <h2 className="font-display text-[15px] font-semibold">{t("perksTitle")}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {perks.map((perk) => (
              <li key={perk} className="flex gap-2.5 text-[14px] leading-snug text-muted">
                <span className="mt-[3px] shrink-0 text-accent">♥</span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          {donate && (
            <a
              href={donate.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block rounded-full bg-accent px-6 py-2.5 text-[14px] font-bold text-ink transition-colors hover:bg-accent-soft"
            >
              ♥ {t("cta")}
            </a>
          )}
        </section>

        {/* Прямо сказать, что проект маленький, честнее, чем делать вид, будто
            это большой сервис с очередью спонсоров. */}
        <section className="mt-4 rounded-2xl border border-hairline bg-white/[0.02] p-5">
          <h2 className="font-display text-[15px] font-semibold">{t("honestTitle")}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">{t("honest")}</p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">
            {t("thanksTitle")}
          </h2>
          {supporters.length === 0 ? (
            <p className="mt-3 text-[14px] text-dim">{t("thanksEmpty")}</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {supporters.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full border border-accent/30 bg-accent/[0.06] px-3.5 py-1.5 text-[13px] font-semibold text-accent"
                >
                  ♥ {s.supporterName}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="h-16" />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}
