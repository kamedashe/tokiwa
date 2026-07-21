import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { localeAlternates } from "@/lib/seo";

// Шапка показывает профиль текущего пользователя.
export const dynamic = "force-dynamic";

/**
 * Бартерная договорённость: каналы бесплатно рассказали о TokiWa, мы взамен
 * упоминаем их здесь. Список ведётся руками — новые записи добавляются в
 * обмен на пост, а не по просьбе.
 */
const CHANNELS: { name: string; url: string; tagKey: "edits" | "arts" | "club" }[] = [
  { name: "AnimEdits", url: "https://t.me/EditsAnimeStyle", tagKey: "edits" },
  { name: "anime_pics", url: "https://t.me/ani_pics", tagKey: "arts" },
  { name: "Аниме клуб MUZA", url: "https://t.me/MUZA_animeclub", tagKey: "club" },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "friends" });
  return { title: t("title"), alternates: { languages: localeAlternates("/friends") } };
}

export default async function FriendsPage() {
  const t = await getTranslations("friends");

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-[720px] px-4 py-10 md:px-10">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mt-2 text-muted">{t("note")}</p>

        <div className="mt-8 flex flex-col gap-3">
          {CHANNELS.map((c) => (
            <a
              key={c.url}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-xl border border-hairline bg-white/[0.02] px-5 py-4 transition-colors hover:border-white/20"
            >
              <span className="flex flex-col">
                <span className="font-display text-[15px] font-semibold">{c.name}</span>
                <span className="text-[12px] text-dim">{t(c.tagKey)} · Telegram</span>
              </span>
              <span className="ml-auto text-[13px] text-dim transition-colors group-hover:text-accent">
                ↗
              </span>
            </a>
          ))}
        </div>
      </div>

      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}
