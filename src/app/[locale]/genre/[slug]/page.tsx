import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { getTranslations } from "next-intl/server";
import { listTitles } from "@/lib/queries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getGenre(slug: string) {
  return prisma.genre.findUnique({ where: { slug }, select: { name: true, slug: true } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getGenre(slug);
  if (!genre) return {};

  return { title: genre.name };
}

export default async function GenrePage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations("catalog");

  const genre = await getGenre(slug);
  if (!genre) notFound();

  const items = await listTitles(locale, { genres: { some: { slug } } }, 100);

  return (
    <main className="min-h-screen">
      <SiteHeader current="/catalog" />
      <TitleGrid
        heading={genre.name}
        subheading={t("titlesCount", { count: items.length })}
        items={items}
        emptyText={t("nothingFound")}
      />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/catalog" />
    </main>
  );
}
