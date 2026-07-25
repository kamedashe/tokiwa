import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { ShareStats } from "@/components/share-stats";
import { auth } from "@/auth";
import { getWrappedStats } from "@/lib/wrapped-queries";
import { formatDuration } from "@/lib/backlog";

// Личная страница — рендерится под пользователя.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "wrapped" });
  return { title: t("title"), robots: { index: false } };
}

export default async function WrappedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login?next=/wrapped");

  const t = await getTranslations("wrapped");
  const time = await getTranslations("time");
  const stats = await getWrappedStats(locale);

  if (!stats || stats.watchedMinutes === 0) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="flex flex-col items-center gap-4 px-6 py-32 text-center">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
          <p className="max-w-md text-muted">{t("empty")}</p>
        </div>
        <SiteFooter />
        <div className="h-20 md:hidden" />
        <MobileNav current="" />
      </main>
    );
  }

  const hours = Math.round(stats.watchedMinutes / 60);
  const days = Math.round(stats.watchedMinutes / 60 / 24);
  const genreNames = stats.topGenres.map((g) => g.name).join(", ");

  const shareText = t("shareText", { hours, days, genres: genreNames || "—" });

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-[860px] px-4 py-10 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mt-2 max-w-[56ch] text-muted">{t("intro")}</p>

        {/* Главное число — часы жизни. Ради этого сюда и приходят. */}
        <div className="mt-8 rounded-2xl border border-accent/30 bg-accent/[0.06] px-6 py-8 text-center">
          <div className="font-display text-[12px] tracking-[0.2em] text-accent">
            {t("hoursWatched")}
          </div>
          <div className="mt-2 font-display text-[clamp(56px,10vw,96px)] font-bold leading-none tracking-[-0.04em] text-accent">
            {hours}
          </div>
          {days >= 1 && (
            <div className="mt-2 text-[15px] text-muted">{t("daysOfLife", { days })}</div>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard label={t("episodes")} value={String(stats.episodesWatched)} />
          <StatCard label={t("completed")} value={String(stats.completedCount)} />
          <StatCard
            label={t("dropped")}
            value={String(stats.droppedCount)}
            sub={stats.dropRate > 0 ? t("dropRate", { percent: stats.dropRate }) : undefined}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {stats.topGenres.length > 0 && (
            <div className="rounded-2xl border border-hairline bg-white/[0.02] p-5">
              <div className="font-display text-[11px] tracking-[0.14em] text-dim">
                {t("topGenres")}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.topGenres.map((g) => (
                  <span
                    key={g.name}
                    className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] text-muted"
                  >
                    {g.name} <span className="text-[11px] text-dim">×{g.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.longest && (
            <div className="rounded-2xl border border-hairline bg-white/[0.02] p-5">
              <div className="font-display text-[11px] tracking-[0.14em] text-dim">
                {t("longest")}
              </div>
              <Link
                href={`/anime/${stats.longest.slug}`}
                className="mt-3 block font-display text-[17px] font-semibold transition-colors hover:text-accent"
              >
                {stats.longest.name}
              </Link>
              <div className="mt-1 text-[13px] text-subtle">
                {formatDuration(time, stats.longest.minutes)}
              </div>
            </div>
          )}
        </div>

        {stats.avgScore !== null && (
          <div className="mt-4 rounded-2xl border border-hairline bg-white/[0.02] p-5">
            <div className="font-display text-[11px] tracking-[0.14em] text-dim">
              {t("avgScore").toUpperCase()}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl text-accent">★</span>
              <span className="font-display text-[28px] font-bold">{stats.avgScore.toFixed(1)}</span>
              <span className="text-[13px] text-faint">/ 10</span>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <ShareStats text={shareText} labels={{ share: t("share"), copied: t("copied") }} />
        </div>
      </div>

      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white/[0.02] p-5">
      <div className="font-display text-[11px] tracking-[0.14em] text-dim">
        {label.toUpperCase()}
      </div>
      <div className="mt-2 font-display text-[28px] font-bold tracking-[-0.02em]">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-subtle">{sub}</div>}
    </div>
  );
}
