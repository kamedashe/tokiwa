import Link from "next/link";
import { SORTS, type SortKey } from "@/lib/queries";

interface Genre {
  name: string;
  slug: string;
  count: number;
}

/** Собирает ссылку, меняя один параметр и сбрасывая страницу на первую. */
function buildHref(
  base: { q?: string; genre?: string; sort: SortKey },
  patch: Partial<{ genre: string | null; sort: SortKey }>,
) {
  const params = new URLSearchParams();
  const genre = patch.genre !== undefined ? patch.genre : base.genre;
  const sort = patch.sort ?? base.sort;

  if (base.q) params.set("q", base.q);
  if (genre) params.set("genre", genre);
  if (sort !== "score") params.set("sort", sort);

  const qs = params.toString();
  return qs ? `/catalog?${qs}` : "/catalog";
}

export function CatalogFilters({
  genres,
  q,
  genre,
  sort,
}: {
  genres: Genre[];
  q?: string;
  genre?: string;
  sort: SortKey;
}) {
  const base = { q, genre, sort };

  return (
    <div className="mb-7 flex flex-col gap-4">
      <div>
        <div className="mb-2 font-display text-[11px] tracking-[0.16em] text-dim">ЖАНР</div>
        {/*
          На телефоне пятнадцать жанров переносами занимают пол-экрана,
          поэтому там это лента с горизонтальным скроллом, а на широком —
          обычный перенос.
        */}
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          <Chip href={buildHref(base, { genre: null })} active={!genre}>
            Все
          </Chip>

          {genres.map((g) => (
            <Chip key={g.slug} href={buildHref(base, { genre: g.slug })} active={genre === g.slug}>
              {g.name}
              <span className="ml-1.5 text-[10px] opacity-60">{g.count}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 font-display text-[11px] tracking-[0.16em] text-dim">СОРТИРОВКА</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <Chip key={key} href={buildHref(base, { sort: key })} active={sort === key}>
              {SORTS[key].label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] transition-colors ${
        active
          ? "bg-accent font-semibold text-ink"
          : "border border-hairline bg-white/[0.03] text-muted hover:border-white/20 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
