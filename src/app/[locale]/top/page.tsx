import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { getTranslations } from "next-intl/server";
import { listTitles } from "@/lib/queries";


// Шапка показывает профиль текущего пользователя.
export const dynamic = "force-dynamic";

export default async function TopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("nav");
  const c = await getTranslations("catalog");
  const items = await listTitles(locale, { score: { not: null } }, 100);

  return (
    <main className="min-h-screen">
      <SiteHeader current="/top" />
      <TitleGrid
        heading={t("top")}
        subheading={c("byScore")}
        items={items}
        emptyText={c("nothingFound")}
      />
      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/catalog" />
    </main>
  );
}
