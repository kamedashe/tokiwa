import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { localeAlternates } from "@/lib/seo";

// Шапка показывает профиль текущего пользователя.
export const dynamic = "force-dynamic";

type TagKey = "edits" | "arts" | "club" | "manga" | "picks" | "memes";

/**
 * Бартерная договорённость: каналы бесплатно рассказали о TokiWa, мы взамен
 * упоминаем их здесь. Список ведётся руками — новые записи добавляются в
 * обмен на пост, а не по просьбе.
 */
const CHANNELS: { name: string; url: string; tagKey: TagKey }[] = [
  { name: "AnimEdits", url: "https://t.me/EditsAnimeStyle", tagKey: "edits" },
  { name: "anime_pics", url: "https://t.me/ani_pics", tagKey: "arts" },
  { name: "Аниме клуб MUZA", url: "https://t.me/MUZA_animeclub", tagKey: "club" },
  { name: "Человек Бензопила", url: "https://t.me/chainsaw_man_fan", tagKey: "manga" },
  { name: "Anime Seek", url: "https://t.me/AnimeSeek", tagKey: "picks" },
  { name: "Анимегид извращенца", url: "https://t.me/anime_v_butovo", tagKey: "memes" },
];

/** «t.me/xxx» → «@xxx» — по хендлу канал ищется в Telegram напрямую. */
function handleOf(url: string): string {
  return "@" + url.replace(/^https:\/\/t\.me\//, "");
}

/** Бумажный самолётик Telegram — чтобы источник считывался с одного взгляда. */
function TelegramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-9 shrink-0 rounded-full bg-[#2AABEE]/15 p-2 text-[#2AABEE]"
      fill="currentColor"
      aria-hidden
    >
      <path d="M21.9 4.3c.2-1-.7-1.7-1.6-1.3L2.7 9.9c-1 .4-1 1.9.1 2.2l4.5 1.4 1.7 5.5c.3.9 1.4 1.1 2 .4l2.5-2.6 4.6 3.4c.8.6 2 .2 2.2-.9l3-14.4-.4-.6zm-3.4 2.5-8.7 7.9-.3 3-1.3-4.3 10-6.9c.4-.3.8.1.3.3z" />
    </svg>
  );
}

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
        <p className="mt-2 max-w-[56ch] text-muted">{t("note")}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <a
              key={c.url}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-hairline bg-white/[0.02] px-5 py-4 transition-colors hover:border-[#2AABEE]/40 hover:bg-[#2AABEE]/[0.04]"
            >
              <TelegramIcon />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-[15px] font-semibold">{c.name}</span>
                <span className="truncate text-[12px] text-dim">
                  {handleOf(c.url)} · {t(c.tagKey)}
                </span>
              </span>
              <span className="ml-auto text-[13px] text-dim transition-colors group-hover:text-[#2AABEE]">
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
