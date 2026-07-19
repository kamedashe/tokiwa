import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Parallax } from "@/components/parallax";
import { Artwork } from "@/components/artwork";
import { WatchlistButton } from "@/components/watchlist-button";
import { SCANLINES_WIDE } from "@/lib/gradient";
import { getEntry } from "@/lib/watchlist";
import type { HeroTitle } from "@/lib/queries";

// Форматы оставляем как есть: TV, Movie, OVA, ONA — их пишут латиницей
// на всех языках, включая японский.
const FORMATS: Record<string, string> = {
  TV: "TV",
  Movie: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  Special: "Special",
};

/** Обрезаем синопсис по границе предложения — иначе ломает вёрстку блока. */
function trim(text: string | null, max = 220) {
  if (!text) return "";
  const clean = text.replace(/\s*\[Written by MAL Rewrite\]\s*$/, "").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > 80 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`;
}

export async function Hero({ item }: { item: HeroTitle }) {
  const t = await getTranslations("home");
  const entry = await getEntry(item.id);
  const inList = entry !== null;

  return (
    <Parallax className="relative mb-2 h-[560px] overflow-hidden max-md:h-[460px]">
      {/*
        Ни один бесплатный источник не даёт арта под блок 1440×560: баннеры
        AniList бывают и 1266×266, постеры — 460×650. Растянутый на всю ширину
        оригинал превращается в мыло.

        Поэтому низкое разрешение уходит в размытую подложку, где его не видно,
        а поверх ставится постер в своих пропорциях — он выводится меньше
        натурального размера и остаётся чётким.
      */}
      <div data-depth="18" className="absolute inset-0">
        <div className="absolute inset-0 scale-125 blur-3xl saturate-150">
          <Artwork
            src={item.bannerUrl ?? item.posterUrl}
            alt=""
            hue={item.hue}
            deg={155}
            mode="backdrop"
            sizes="100vw"
            quality={20}
            scanlines="none"
          />
        </div>
        <div className="absolute inset-0 bg-ink/35" aria-hidden />
      </div>

      <div
        data-depth="10"
        className="absolute bottom-0 right-[6%] top-0 aspect-[2/3] py-8 max-lg:right-0 max-lg:opacity-70 max-md:hidden"
      >
        <div className="relative size-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          <Artwork
            src={item.posterUrl}
            alt={item.title}
            hue={item.hue}
            deg={155}
            sizes="(max-width: 1024px) 0px, 480px"
            priority
            quality={95}
            scanlines={SCANLINES_WIDE}
          />
        </div>
      </div>

      {/* Тёплое свечение справа — «пульсирует» как в макете. */}
      <div
        data-depth="10"
        className="animate-glowpulse absolute right-[6%] top-[8%] size-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,176,32,0.28),transparent_65%)] blur-[20px] max-md:hidden"
        aria-hidden
      />

      {/* Двойная маска: затемняет слева и снизу, чтобы текст читался. */}
      <div
        className="absolute inset-0 bg-[linear-gradient(90deg,#050506_10%,rgba(5,5,6,0.75)_45%,rgba(5,5,6,0.15)_72%),linear-gradient(0deg,#050506_2%,transparent_40%)]"
        aria-hidden
      />

      <div className="absolute right-10 top-6 font-display text-[11px] tracking-[0.16em] text-white/40 max-md:hidden">
        // {t("keyVisual")} — {item.title}
      </div>

      <div data-depth="-8" className="absolute bottom-14 left-6 max-w-[620px] md:left-16">
        <div className="mb-[18px] flex items-center gap-3">
          <span className="rounded-md bg-accent px-2.5 py-[5px] text-xs font-bold tracking-[0.04em] text-ink">
            {t("spotlight")}
          </span>
          <span className="text-[13px] text-muted">
            {[item.format ? (FORMATS[item.format] ?? item.format) : null, item.year]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>

        {/* В макете заголовок в одну-две строки. Реальные названия из MAL
            бывают втрое длиннее, поэтому кегль плавающий, а строк максимум три. */}
        <h1 className="mb-1.5 line-clamp-3 font-display text-[clamp(32px,4.4vw,64px)] font-bold leading-[0.98] tracking-[-0.03em]">
          {item.title}
        </h1>

        {(item.original || item.titleJp) && (
          <div className="mb-5 text-base tracking-[0.02em] text-subtle">
            {[item.original, item.titleJp].filter(Boolean).join(" · ")}
          </div>
        )}

        <p className="mb-7 text-base leading-relaxed text-pretty text-muted max-md:hidden">
          {trim(item.synopsis)}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/anime/${item.slug}`}
            className="flex items-center gap-2.5 rounded-full bg-accent px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-accent-soft"
          >
            <span
              className="size-0 border-y-[6px] border-l-[9px] border-y-transparent border-l-ink"
              aria-hidden
            />
            {t("watch")}
          </Link>

          <WatchlistButton titleId={item.id} initialInList={inList} />

          {item.score !== null && (
            <div className="ml-2 flex items-center gap-[7px]">
              <span className="text-xl text-accent">★</span>
              <span className="font-display text-xl font-bold">{item.score.toFixed(1)}</span>
              <span className="text-[13px] text-faint">/ 10</span>
            </div>
          )}
        </div>
      </div>
    </Parallax>
  );
}
