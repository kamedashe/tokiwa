import { Link } from "@/i18n/navigation";
import { Artwork } from "@/components/artwork";
import type { CardTitle } from "@/lib/queries";

/** Карточка тайтла 2:3 — основа горизонтальных рядов на главной. */
export function AnimeCard({ item, deg = 150 }: { item: CardTitle; deg?: number }) {
  return (
    <Link
      href={`/anime/${item.slug}`}
      // Ширина фиксированная только в рядах со скроллом; в сетке карточка
      // растягивается по колонке, поэтому w-full и min-w-0.
      className="group w-full min-w-0 shrink-0 snap-start focus:outline-none"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-[14px] border border-hairline bg-surface transition-transform duration-300 group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-accent">
        <Artwork
          src={item.posterUrl}
          alt={item.title}
          hue={item.hue}
          deg={deg}
          sizes="(max-width: 640px) 45vw, 186px"
        />

        {item.score !== null && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-ink/55 px-2 py-1 backdrop-blur-[6px]">
            <span className="text-[11px] text-accent">★</span>
            <span className="font-display text-xs font-semibold">{item.score.toFixed(1)}</span>
          </div>
        )}

        {/* Затемнение снизу, чтобы название читалось поверх арта. */}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,5,6,0.92)_4%,transparent_42%)]" />

        <div className="absolute inset-x-3 bottom-3">
          <div className="mb-[5px] line-clamp-2 font-display text-[15px] font-semibold leading-[1.12] tracking-[-0.01em] text-pretty">
            {item.title}
          </div>
          {/* Оригинал мелким — по нему ищут те, кто привык к ромадзи. */}
          {item.original && (
            <div className="mb-1 line-clamp-1 text-[10px] text-faint">{item.original}</div>
          )}
          {/* «Серия 12 — завтра» у онгоингов в «Продолжить просмотр». */}
          {item.note && (
            <div className="mb-1 line-clamp-1 text-[10px] font-semibold text-accent">
              {item.note}
            </div>
          )}
          <div className="text-[11px] tracking-[0.02em] text-muted-2">{item.tags}</div>
        </div>
      </div>
    </Link>
  );
}
