import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Админка" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter } = await searchParams;
  const search = q?.trim();

  const titles = await prisma.title.findMany({
    where: {
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
      // Быстрый способ найти, чему ещё не проставили ссылки.
      ...(filter === "empty" ? { watchLinks: { none: {} } } : {}),
    },
    orderBy: [{ score: "desc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      year: true,
      episodesCount: true,
      _count: { select: { watchLinks: true } },
    },
  });

  const [total, withLinks] = await Promise.all([
    prisma.title.count(),
    prisma.title.count({ where: { watchLinks: { some: {} } } }),
  ]);

  return (
    <div className="px-4 py-8 md:px-10">
      <div className="mb-6 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-[26px] font-bold tracking-[-0.03em]">Ссылки на сервисы</h1>
        <span className="font-display text-xs tracking-[0.1em] text-dim">
          {withLinks} из {total} тайтлов заполнены
        </span>
      </div>

      <form className="mb-5 flex flex-wrap gap-2" action="/admin">
        <input
          name="q"
          defaultValue={search ?? ""}
          placeholder="Поиск по названию…"
          aria-label="Поиск по названию"
          className="w-[280px] rounded-full border border-hairline bg-white/5 px-4 py-2 text-[13px] text-foreground placeholder:text-faint focus:border-accent/50 focus:outline-none"
        />
        {filter === "empty" && <input type="hidden" name="filter" value="empty" />}
        <button
          type="submit"
          className="rounded-full bg-accent px-5 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-accent-soft"
        >
          Найти
        </button>
      </form>

      <div className="mb-6 flex gap-2">
        <FilterChip href={search ? `/admin?q=${encodeURIComponent(search)}` : "/admin"} active={filter !== "empty"}>
          Все
        </FilterChip>
        <FilterChip
          href={search ? `/admin?q=${encodeURIComponent(search)}&filter=empty` : "/admin?filter=empty"}
          active={filter === "empty"}
        >
          Без ссылок
        </FilterChip>
      </div>

      {titles.length === 0 ? (
        <p className="text-subtle">Ничего не нашлось.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-hairline text-[12px] text-dim">
                <th className="px-4 py-3 font-medium">Тайтл</th>
                <th className="px-4 py-3 font-medium">Год</th>
                <th className="px-4 py-3 font-medium">Ссылок</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {titles.map((t) => (
                <tr key={t.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">{t.title}</td>
                  <td className="px-4 py-3 text-subtle">{t.year ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={t._count.watchLinks > 0 ? "text-accent" : "text-dim"}>
                      {t._count.watchLinks}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/titles/${t.id}`}
                      className="text-[13px] text-accent hover:text-accent-soft"
                    >
                      Править →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
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
      className={`rounded-full px-3.5 py-1.5 text-[12px] transition-colors ${
        active
          ? "bg-accent font-semibold text-ink"
          : "border border-hairline text-muted hover:border-white/20 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
