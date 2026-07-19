import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { Artwork } from "@/components/artwork";
import { ProgressStepper } from "@/components/progress-stepper";
import { WatchlistButton } from "@/components/watchlist-button";
import { StatusPicker } from "@/components/status-picker";
import { WatchLinks } from "@/components/watch-links";
import { prisma } from "@/lib/prisma";
import { getEntry } from "@/lib/watchlist";
import { visitorCountry } from "@/lib/geo";
import { formatDuration, remainingMinutes } from "@/lib/backlog";

// Страница показывает статус тайтла у текущего пользователя.
export const dynamic = "force-dynamic";

const STATUS_RU: Record<string, string> = {
  releasing: "Выходит",
  finished: "Завершён",
  not_yet_aired: "Анонс",
};

async function getTitle(slug: string) {
  return prisma.title.findUnique({
    where: { slug },
    include: {
      genres: { select: { name: true, slug: true } },
      watchLinks: { orderBy: { service: "asc" } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = await getTitle(slug);
  if (!title) return { title: "Тайтл не найден" };

  const display = title.titleRu ?? title.title;

  return {
    title: display,
    description: title.synopsis?.slice(0, 160) ?? undefined,
    openGraph: {
      title: display,
      description: title.synopsis?.slice(0, 160) ?? undefined,
      images: title.posterUrl ? [title.posterUrl] : undefined,
    },
  };
}

export default async function TitlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = await getTitle(slug);
  if (!title) notFound();

  const [entry, country] = await Promise.all([getEntry(title.id), visitorCountry()]);
  const timeLeft = remainingMinutes(title, entry?.progress ?? 0);

  const meta = [
    title.format,
    title.year,
    title.status ? STATUS_RU[title.status] : null,
    title.episodesCount ? `${title.episodesCount} эп.` : null,
  ].filter(Boolean);

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-8 md:grid-cols-[280px_1fr] md:px-10">
        <aside className="max-md:mx-auto max-md:w-[220px]">
          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-hairline bg-surface">
            <Artwork
              src={title.posterUrl}
              alt={title.title}
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
            {title.titleRu ?? title.title}
          </h1>
          {(title.titleRu || title.titleJp) && (
            <div className="mt-2 text-subtle">
              {[title.titleRu ? title.title : null, title.titleJp].filter(Boolean).join(" · ")}
            </div>
          )}

          <div className="mt-3 text-[13px] text-muted">{meta.join(" · ")}</div>

          {title.synopsis && (
            <p className="mt-6 max-w-[70ch] leading-relaxed text-pretty text-muted">
              {title.synopsis}
            </p>
          )}

          <section className="mt-10">
            <h2 className="mb-4 font-display text-[21px] font-semibold tracking-[-0.02em]">
              Прогресс
            </h2>
            <ProgressStepper
              titleId={title.id}
              initialProgress={entry?.progress ?? 0}
              episodesCount={title.episodesCount}
            />
            {timeLeft > 0 && (
              <p className="mt-4 text-[13px] text-subtle">
                Досмотреть: <span className="text-accent">{formatDuration(timeLeft)}</span>
              </p>
            )}
          </section>

          {title.watchLinks.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-1 font-display text-[21px] font-semibold tracking-[-0.02em]">
                Где посмотреть
              </h2>
              <p className="mb-4 text-[13px] text-dim">
                Лицензионные сервисы — там дубляж и качество, но встроить их к себе нельзя.
              </p>
              <WatchLinks links={title.watchLinks} country={country} />
            </section>
          )}

        </div>
      </div>

      <div className="h-16" />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}
