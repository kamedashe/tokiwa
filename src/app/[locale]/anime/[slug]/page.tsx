import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { Artwork } from "@/components/artwork";
import { TitleListActions, TitleProgress } from "@/components/title-actions";
import { AnimeCard } from "@/components/anime-card";
import { prisma } from "@/lib/prisma";
import { getNearby, type CardTitle } from "@/lib/queries";
import { formatDuration, totalMinutes } from "@/lib/backlog";
import { pickTitle } from "@/lib/title-locale";
import { localeAlternates } from "@/lib/seo";
import { animeJsonLd, serializeJsonLd } from "@/lib/structured-data";

// Страница публичная и одинаковая для всех: личный статус подтягивают
// клиентские блоки. Перерисовываем раз в час — данные о сериях меняет крон.
export const revalidate = 3600;

/**
 * Пустой список — намеренно: пятнадцать тысяч тайтлов на четырёх языках при
 * сборке не отрисовать. Но сама функция обязана быть: без неё Next считает
 * страницу с динамическим сегментом полностью динамической и молча
 * игнорирует revalidate, а значит каждый заход робота идёт прямиком в базу —
 * ровно то, что в августе выбрало месячную квоту.
 *
 * С ней включается отложенная генерация: первый запрос страницу собирает,
 * дальше её отдают из кэша, пока не истечёт час.
 */
export function generateStaticParams() {
  return [];
}

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

  const time = await getTranslations("time");
  const nearby = await getNearby(title.id, locale);

  const fullLength = totalMinutes(title);

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

          <TitleListActions titleId={title.id} />

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
            <TitleProgress titleId={title.id} episodesCount={title.episodesCount} />
            {/* Полная длительность вместо «осталось досмотреть»: остаток
                зависит от прогресса, а он теперь известен только браузеру. */}
            {fullLength > 0 && (
              <p className="mt-4 text-[13px] text-subtle">
                {t("totalLength")}{" "}
                <span className="text-accent">{formatDuration(time, fullLength)}</span>
              </p>
            )}
          </section>

        </div>
      </div>

      {/* Франшиза и похожее — рядом, чтобы после серии было куда пойти дальше,
          не возвращаясь в каталог. Своя франшиза идёт первой. */}
      {(nearby.franchise.length > 0 || nearby.similar.length > 0) && (
        <div className="mx-auto mt-14 max-w-[1200px] px-4 md:px-10">
          {nearby.franchise.length > 0 && (
            <NearbyRow heading={t("franchise")} items={nearby.franchise} />
          )}
          {nearby.similar.length > 0 && (
            <NearbyRow heading={t("similar")} items={nearby.similar} />
          )}
        </div>
      )}

      <div className="h-16" />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}

/** Ряд карточек под тайтлом: франшиза или похожее. */
function NearbyRow({ heading, items }: { heading: string; items: CardTitle[] }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="font-display text-[21px] font-semibold tracking-[-0.02em]">{heading}</h2>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-[18px]">
        {items.map((item, i) => (
          <AnimeCard key={item.id} item={item} deg={150 + (i % 8) * 6} />
        ))}
      </div>
    </section>
  );
}
