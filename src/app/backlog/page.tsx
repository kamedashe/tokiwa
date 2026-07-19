import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { AnimeCard } from "@/components/anime-card";
import { auth } from "@/auth";
import { getBacklogStats, getFitting, type BacklogItem } from "@/lib/backlog-queries";
import { TIME_BUDGETS, budgetMinutes, formatDuration, paceEstimate } from "@/lib/backlog";

export const metadata = { title: "Сколько у меня времени" };
export const dynamic = "force-dynamic";

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<{ budget?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/backlog");

  const { budget: budgetKey } = await searchParams;
  const budget = budgetMinutes(budgetKey ?? "") ?? null;

  const [stats, fitting] = await Promise.all([
    getBacklogStats(),
    budget ? getFitting(budget) : Promise.resolve(null),
  ]);

  if (!stats) redirect("/login?next=/backlog");

  const totalAhead = stats.plannedMinutes + stats.watchingMinutes;

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">
          Сколько у меня времени
        </h1>
        <p className="mt-2 max-w-[60ch] text-[15px] text-muted">
          Список — это часы, а не строчки. Здесь видно, во что он превращается, и что из него
          реально закрыть за вечер.
        </p>

        {totalAhead === 0 && stats.completedCount === 0 ? (
          <Empty />
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <Stat
                label="Впереди"
                value={formatDuration(totalAhead)}
                sub={`${stats.plannedCount + stats.watchingCount} тайтлов`}
                accent
              />
              <Stat
                label="Начато и не закончено"
                value={formatDuration(stats.watchingMinutes)}
                sub={`${stats.watchingCount} в процессе`}
              />
              <Stat
                label="Уже посмотрено"
                value={formatDuration(stats.completedMinutes)}
                sub={`${stats.completedCount} закрыто`}
              />
            </section>

            {totalAhead > 0 && (
              <section className="mt-4 rounded-2xl border border-hairline bg-white/[0.02] p-5">
                <div className="font-display text-[13px] tracking-[0.14em] text-dim">
                  ЧТОБЫ ЗАКРЫТЬ ВСЁ
                </div>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
                  <Pace label="по часу в день" value={paceEstimate(totalAhead, 60)} />
                  <Pace label="по 2 часа в день" value={paceEstimate(totalAhead, 120)} />
                  <Pace label="по выходным, 6 ч" value={paceEstimate(totalAhead, 6 * 60 / 7)} />
                </div>
              </section>
            )}

            <section className="mt-10">
              <h2 className="font-display text-[21px] font-semibold tracking-[-0.02em]">
                Что успею посмотреть
              </h2>
              <p className="mt-1 text-[13px] text-dim">
                Начатое идёт первым — логичнее закрыть его, чем начинать новое.
              </p>

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
                    {b.label}
                    <span className="ml-1.5 text-[11px] opacity-60">{b.hint}</span>
                  </Link>
                ))}
                {budgetKey && (
                  <Link href="/backlog" scroll={false} className="self-center px-2 text-[13px] text-dim hover:text-foreground">
                    Сбросить
                  </Link>
                )}
              </div>

              {fitting && <Results fitting={fitting} budget={budget ?? 0} />}
            </section>
          </>
        )}
      </div>

      <div className="h-16" />
      <div className="h-20 md:hidden" />
      <MobileNav current="/backlog" />
    </main>
  );
}

function Results({
  fitting,
  budget,
}: {
  fitting: { fits: BacklogItem[]; tooLong: BacklogItem[] };
  budget: number;
}) {
  if (fitting.fits.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
        <p className="text-muted">
          За {formatDuration(budget)} целиком не закрыть ничего из списка.
        </p>
        {fitting.tooLong.length > 0 && (
          <p className="mt-2 text-[13px] text-dim">
            Ближе всего — «{fitting.tooLong[0].title}», на неё нужно{" "}
            {formatDuration(fitting.tooLong[0].minutes)}.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 text-[13px] text-subtle">
        Помещается: <span className="text-accent">{fitting.fits.length}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-[18px]">
        {fitting.fits.map((item, i) => (
          <div key={item.id} className="flex w-[186px] flex-col gap-2">
            <AnimeCard item={item} deg={150 + (i % 8) * 6} />
            <div className="text-[12px] text-muted">
              {formatDuration(item.minutes)}
              {item.estimated && (
                <span className="ml-1 text-dim" title="Длительность неизвестна, взята типовая">
                  ≈
                </span>
              )}
              {item.episodesCount && item.format !== "Movie" && (
                <span className="text-dim"> · {item.episodesCount} эп.</span>
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

function Empty() {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
      <p className="text-muted">Список пуст — считать нечего.</p>
      <Link
        href="/catalog"
        className="mt-4 inline-block rounded-full bg-accent px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-accent-soft"
      >
        Набрать тайтлов
      </Link>
    </div>
  );
}
