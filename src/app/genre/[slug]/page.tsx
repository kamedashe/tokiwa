import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { listTitles } from "@/lib/queries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getGenre(slug: string) {
  return prisma.genre.findUnique({ where: { slug }, select: { name: true, slug: true } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getGenre(slug);
  if (!genre) return { title: "Жанр не найден" };

  return {
    title: genre.name,
    description: `Аниме в жанре ${genre.name} — оценки, описания, серии.`,
  };
}

export default async function GenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const genre = await getGenre(slug);
  if (!genre) notFound();

  const items = await listTitles({ genres: { some: { slug } } }, 100);

  return (
    <main className="min-h-screen">
      <SiteHeader current="/catalog" />
      <TitleGrid heading={genre.name} subheading={`${items.length} тайтлов`} items={items} />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/catalog" />
    </main>
  );
}
