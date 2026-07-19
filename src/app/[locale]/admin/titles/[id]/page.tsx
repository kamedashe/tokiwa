import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WatchLinkEditor } from "@/components/admin/watch-link-editor";

export const metadata = { title: "Где посмотреть" };

export default async function AdminTitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const titleId = Number(id);
  if (!Number.isInteger(titleId)) notFound();

  const title = await prisma.title.findUnique({
    where: { id: titleId },
    select: {
      id: true,
      slug: true,
      title: true,
      year: true,
      episodesCount: true,
      watchLinks: { orderBy: { service: "asc" } },
    },
  });

  if (!title) notFound();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-10">
      <Link href="/admin" className="text-[13px] text-subtle hover:text-foreground">
        ← Ко всем тайтлам
      </Link>

      <div className="mb-1 mt-4 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-[26px] font-bold tracking-[-0.03em]">{title.title}</h1>
        <span className="text-[13px] text-dim">{title.year ?? "—"}</span>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-4 text-[13px] text-subtle">
        <span>{title.episodesCount ? `${title.episodesCount} эп.` : "число серий неизвестно"}</span>
        <Link href={`/anime/${title.slug}`} className="text-accent hover:text-accent-soft">
          Открыть на сайте →
        </Link>
      </div>

      <WatchLinkEditor titleId={title.id} links={title.watchLinks} />
    </div>
  );
}
