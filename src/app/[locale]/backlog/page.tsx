import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { AnimeCard } from "@/components/anime-card";
import { auth } from "@/auth";
import { getBacklogStats, getFitting, type BacklogItem } from "@/lib/backlog-queries";
import { TIME_BUDGETS, budgetMinutes, formatDuration, paceEstimate } from "@/lib/backlog";
import { pickDonateLink } from "@/lib/donate";
import { visitorCountry } from "@/lib/geo";

export const dynamic = "force-dynamic";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export default async function BacklogPage({
  searchParams,
  params,
}: {
  searchParams: Promise<{ budget?: string }>;
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/backlog");

  const [{ budget: budgetKey }, { locale }] = await Promise.all([searchParams, params]);
  const t = await getTranslations("backlog");
  const time = await getTranslations("time");

  const budget = budgetMinutes(budgetKey ?? "") ?? null;

  const [stats, fitting, donate, footer] = await Promise.all([
    getBacklogStats(),
    budget ? getFitting(locale, budget) : Promise.resolve(null),
    visitorCountry().then(pickDonateLink),
    getTranslations("footer"),
  ]);

  if (!stats) redirect("/login?next=/backlog");

  const totalAhead = stats.plannedMinutes + stats.watchingMinutes;

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mt-2 max-w-[60ch] text-[15px] text-muted">{t("intro")}</p>

        {totalAhead === 0 && stats.completedCount === 0 ? (
          <Empty text={t("emptyText")} cta={t("getTitles")} />
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <Stat
                label={t("ahead")}
                value={formatDuration(time, totalAhead)}
                sub={t("inProgress", { count: stats.plannedCount + stats.watchingCount })}
                accent
              />
              <Stat
                label={t("started")}
                value={formatDuration(time, stats.watchingMinutes)}
                sub={t("inProgress", { count: stats.watchingCount })}
              />
              <Stat
                label={t("watched")}
                value={formatDuration(time, stats.completedMinutes)}
                sub={t("closed", { count: stats.completedCount })}
              />
            </section>

            {totalAhead > 0 && (
              <section className="mt-4 rounded-2xl border border-hairline bg-white/[0.02] p-5">
                <div className="font-display text-[13px] tracking-[0.14em] text-dim">
                  {t("toFinishAll")}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                  <Pace label={t("perHour")} value={paceEstimate(time, totalAhead, 60)} />
                  <Pace label={t("perTwoHours")} value={paceEstimate(time, totalAhead, 120)} />
                  <Pace
                    label={t("perWeekend")}
                    value={paceEstimate(time, totalAhead, (6 * 60) / 7)}
                  />
                </div>

                {/* Человек только что увидел свои часы — лучший момент,
                    чтобы тихо напомнить про поддержку. Без ссылки в окружении
                    строчка не появляется вовсе. */}
                {donate && (
                  <p className="mt-4 border-t border-hairline pt-3 text-[12px] text-dim">
                    {t("supportHint")}{" "}
                    <a
                      href={donate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent transition-colors hover:text-accent-soft"
                    >
                      ♥ {footer("support")}
                    </a>
                  </p>
                )}
              </section>
            )}

            <section className="mt-10">
              <h2 className="font-display text-[21px] font-semibold tracking-[-0.02em]">
                {t("whatFits")}
              </h2>
              <p className="mt-1 text-[13px] text-dim">{t("whatFitsNote")}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {TIME_BUDGETS.map((b) => (
                  <Link
                    key={b.key}
                    href={`/backlog?budget=${b.key}`}
                    scroll={false}
                    className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                      budgetKey === b.key
                        ? "bg-accent font-semibold text-ink"
                        : "border border-hairline bg-white/[0.03] text-muted hover:border-white/20 hover:text-foreground"
                    }`}
                  >
                    {t(b.key)}
                    <span className="ml-1.5 text-[11px] opacity-60">
                      {time("hours", { count: b.hours })}
                    </span>
                  </Link>
                ))}
                {budgetKey && (
                  <Link
                    href="/backlog"
                    scroll={false}
                    className="self-center px-2 text-[13px] text-dim hover:text-foreground"
                  >
                    {t("reset")}
                  </Link>
                )}
              </div>

              {fitting && <Results fitting={fitting} budget={budget ?? 0} t={t} time={time} />}
            </section>
          </>
        )}
      </div>

      <div className="h-16" />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/backlog" />
    </main>
  );
}

function Results({
  fitting,
  budget,
  t,
  time,
}: {
  fitting: { fits: BacklogItem[]; tooLong: BacklogItem[] };
  budget: number;
  t: Translate;
  time: Translate;
}) {
  if (fitting.fits.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
        <p className="text-muted">{t("nothingFits", { time: formatDuration(time, budget) })}</p>
        {fitting.tooLong.length > 0 && (
          <p className="mt-2 text-[13px] text-dim">
            {t("closest", {
              title: fitting.tooLong[0].title,
              time: formatDuration(time, fitting.tooLong[0].minutes),
            })}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 text-[13px] text-subtle">
        {t("fits")} <span className="text-accent">{fitting.fits.length}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-[18px]">
        {fitting.fits.map((item, i) => (
          <div key={item.id} className="flex flex-col gap-2">
            <AnimeCard item={item} deg={150 + (i % 8) * 6} />
            <div className="text-[12px] text-muted">
              {formatDuration(time, item.minutes)}
              {item.estimated && (
                <span className="ml-1 text-dim" title={t("estimatedHint")}>
                  ≈
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? "border-accent/30 bg-accent/[0.06]" : "border-hairline bg-white/[0.02]"
      }`}
    >
      <div className="font-display text-[11px] tracking-[0.14em] text-dim">
        {label.toUpperCase()}
      </div>
      <div
        className={`mt-2 font-display text-[28px] font-bold tracking-[-0.02em] ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[12px] text-subtle">{sub}</div>
    </div>
  );
}

function Pace({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-[19px] font-bold tracking-[-0.02em]">{value}</div>
      <div className="text-[12px] text-subtle">{label}</div>
    </div>
  );
}

function Empty({ text, cta }: { text: string; cta: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <p className="text-muted">{text}</p>
      <Link
        href="/catalog"
        className="mt-4 inline-block rounded-full bg-accent px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-accent-soft"
      >
        {cta}
      </Link>
    </div>
  );
}
