import Link from "next/link";

/**
 * Постраничная навигация. Показываем края и окно вокруг текущей страницы,
 * остальное схлопываем в «…».
 */
export function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;

  const window = new Set<number>([1, pages, page, page - 1, page + 1]);
  const visible = [...window].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);

  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Страницы">
      {page > 1 && (
        <Link
          href={hrefFor(page - 1)}
          className="rounded-lg border border-hairline px-3 py-2 text-[13px] text-muted transition-colors hover:border-white/20 hover:text-foreground"
        >
          ← Назад
        </Link>
      )}

      {visible.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && visible[i - 1] !== p - 1 && <span className="text-dim">…</span>}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={`rounded-lg px-3.5 py-2 font-display text-[13px] font-semibold transition-colors ${
              p === page
                ? "bg-accent text-ink"
                : "border border-hairline text-muted hover:border-white/20 hover:text-foreground"
            }`}
          >
            {p}
          </Link>
        </span>
      ))}

      {page < pages && (
        <Link
          href={hrefFor(page + 1)}
          className="rounded-lg border border-hairline px-3 py-2 text-[13px] text-muted transition-colors hover:border-white/20 hover:text-foreground"
        >
          Вперёд →
        </Link>
      )}
    </nav>
  );
}
