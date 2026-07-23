import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { Artwork } from "@/components/artwork";
import { ProgressStepper } from "@/components/progress-stepper";
import { WatchlistButton } from "@/components/watchlist-button";
import { StatusPicker } from "@/components/status-picker";
import { prisma } from "@/lib/prisma";
import { getEntry } from "@/lib/watchlist";
import { formatDuration, remainingMinutes } from "@/lib/backlog";
import { pickTitle } from "@/lib/title-locale";
import { localeAlternates } from "@/lib/seo";
import { animeJsonLd, serializeJsonLd } from "@/lib/structured-data";

// Страница показывает статус тайтла у текущего пользователя.
export const dynamic = "force-dynamic";

const STATUS_KEYS: Record<string, string> = {
  releasing: "statusReleasing",
  finished: "statusFinished",
  not_yet_aired: "statusAnnounced",
};

async function getTitle(slug: string) {
  return prisma.title.findUnique({
    where: { slug },
    include: {
      genres: { select: { name: true, slug: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const title = await getTitle(slug);
  if (!title) return {};

  const display = pickTitle(title, locale).title;

  return {
    title: display,
    description: title.synopsis?.slice(0, 160) ?? undefined,
    alternates: { languages: localeAlternates(`/anime/${slug}`) },
    openGraph: {
      title: display,
      description: title.synopsis?.slice(0, 160) ?? undefined,
      images: title.posterUrl ? [title.posterUrl] : undefined,
    },
  };
}

export default async function TitlePage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations("title");
  const title = await getTitle(slug);
  if (!title) notFound();

  const names = pickTitle(title, locale);

  const entry = await getEntry(title.id);
  const time = await getTranslations("time");
  const timeLeft = remainingMinutes(title, entry?.progress ?? 0);

  const meta = [
    title.format,
    title.year,
    title.status ? t(STATUS_KEYS[title.status]) : null,
    title.episodesCount ? t("episodes", { count: title.episodesCount }) : null,
  ].filter(Boolean);

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(animeJsonLd(title, names.title, locale)),
        }}
      />
      <SiteHeader />

      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-8 md:grid-cols-[280px_1fr] md:px-10">
        <aside className="max-md:mx-auto max-md:w-[220px]">
          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-hairline bg-surface">
            <Artwork
              src={title.posterUrl}
              alt={names.title}
              hue={title.hue}
              sizes="280px"
              priority
            />
          </div>

          {title.score !== null && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xl text-accent">★</span>
              <span className="font-display text-xl font-bold">{title.score.toFixed(1)}</span>
              <span className="text-[13px] text-faint">/ 10</span>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3">
            <WatchlistButton
              titleId={title.id}
              initialInList={entry !== null}
              className="w-full !py-2.5 !text-[14px]"
            />
            <StatusPicker titleId={title.id} initialStatus={entry?.status ?? null} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {title.genres.map((g) => (
              <Link
                key={g.slug}
                href={`/genre/${g.slug}`}
                className="rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-white/10 hover:text-foreground"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <h1 className="font-display text-[clamp(28px,3.4vw,44px)] font-bold leading-[1.02] tracking-[-0.03em]">
            {names.title}
          </h1>
          {(names.original || title.titleJp) && (
            <div className="mt-2 text-subtle">
              {[names.original, title.titleJp]
                .filter((v, i, a) => v && a.indexOf(v) === i)
                .join(" · ")}
            </div>
          )}

          <div className="mt-3 text-[13px] text-muted">{meta.join(" · ")}</div>

          {/* У онгоингов показываем, когда следующая серия — причина вернуться. */}
          {title.status === "releasing" && title.nextEpisodeAt && (
            <div className="mt-2 text-[13px] text-accent">
              {t("nextEpisode", {
                date: new Intl.DateTimeFormat(locale, {
                  day: "numeric",
                  month: "long",
                }).format(title.nextEpisodeAt),
              })}
            </div>
          )}

          {title.synopsis && (
            <p className="mt-6 max-w-[70ch] leading-relaxed text-pretty text-muted">
              {title.synopsis}
            </p>
          )}

          <section className="mt-10">
            <h2 className="mb-4 font-display text-[21px] font-semibold tracking-[-0.02em]">
              {t("progress")}
            </h2>
            <ProgressStepper
              titleId={title.id}
              initialProgress={entry?.progress ?? 0}
              episodesCount={title.episodesCount}
            />
            {timeLeft > 0 && (
              <p className="mt-4 text-[13px] text-subtle">
                {t("timeLeft")}{" "}
                <span className="text-accent">{formatDuration(time, timeLeft)}</span>
              </p>
            )}
          </section>

        </div>
      </div>

      <div className="h-16" />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}
