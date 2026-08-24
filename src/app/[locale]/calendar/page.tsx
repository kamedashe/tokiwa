import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { Artwork } from "@/components/artwork";
import { getWeekSchedule, type CalendarItem } from "@/lib/queries";
import { getViewerId } from "@/lib/guest";
import { localeAlternates, ogImage } from "@/lib/seo";

// Календарь помечает тайтлы из списка посетителя — рендер под каждого.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "calendar" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { languages: localeAlternates("/calendar") },
    openGraph: { images: [ogImage({ title: t("title"), subtitle: t("intro") })] },
  };
}

export default async function CalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("calendar");
  const viewerId = await getViewerId();
  const items = await getWeekSchedule(locale, viewerId);

  // Группируем по календарным дням.
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = dayKey(item.at);
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(item);
  }

  const todayKey = dayKey(new Date());
  const tomorrowKey = dayKey(new Date(Date.now() + 86_400_000));
  const fmtDay = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const fmtTime = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });

  const dayLabel = (key: string) => {
    if (key === todayKey) return t("today");
    if (key === tomorrowKey) return t("tomorrow");
    const label = fmtDay.format(new Date(key));
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-[860px] px-4 py-8 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mt-2 text-[15px] text-muted">{t("intro")}</p>

        {byDay.size === 0 ? (
          <p className="mt-16 text-center text-muted">{t("empty")}</p>
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {[...byDay.entries()].map(([key, dayItems]) => (
              <section key={key}>
                <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">
                  {dayLabel(key)}
                </h2>
                <div className="mt-3 flex flex-col gap-2">
                  {dayItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/anime/${item.slug}`}
                      className={`group flex items-center gap-4 rounded-2xl border p-3 transition-colors ${
                        item.inList
                          ? "border-accent/30 bg-accent/[0.05] hover:border-accent/50"
                          : "border-hairline bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface">
                        <Artwork src={item.posterUrl} alt={item.title} hue={item.hue} sizes="48px" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-[15px] font-semibold transition-colors group-hover:text-accent">
                          {item.title}
                        </div>
                        <div className="mt-0.5 text-[12px] text-muted">
                          {t("episode", { n: item.episode })} · {fmtTime.format(item.at)}
                        </div>
                      </div>

                      {item.inList && (
                        <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent">
                          ✓ {t("inList")}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="h-16" />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/calendar" />
    </main>
  );
}
