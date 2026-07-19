import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { TitleGrid } from "@/components/title-grid";
import { listTitles } from "@/lib/queries";

export const metadata = { title: "Топ-100" };
// Шапка показывает профиль текущего пользователя.
export const dynamic = "force-dynamic";

export default async function TopPage() {
  const items = await listTitles({ score: { not: null } }, 100);

  return (
    <main className="min-h-screen">
      <SiteHeader current="/top" />
      <TitleGrid heading="Топ-100" subheading="по оценке" items={items} />
      <div className="h-20 md:hidden" />
      <MobileNav current="/catalog" />
    </main>
  );
}
