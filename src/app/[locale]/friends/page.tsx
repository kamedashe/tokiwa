import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TelegramIcon } from "@/components/telegram-icon";
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
  { name: "Аниме на каждый день", url: "https://t.me/AnimeForEveryDays", tagKey: "picks" },
  { name: "Anime Fan / Аниме клипы", url: "https://t.me/animefan_clips", tagKey: "edits" },
  { name: "Loy | Аниме Эдиты", url: "https://t.me/Loy_Anime_Edits", tagKey: "edits" },
  { name: "HuB Otaku", url: "https://t.me/+fJnZOvlu7EMwMmYy", tagKey: "manga" },
  { name: "AnimeRu — аниме в телеграме", url: "https://t.me/SmotretAnimeRu", tagKey: "picks" },
];

/**
 * «t.me/xxx» → «@xxx»: по хендлу канал ищется в Telegram напрямую.
 * У закрытых каналов вместо имени ссылка-приглашение («t.me/+AbC…») —
 * показывать её как хендл бессмысленно, поэтому null.
 */
function handleOf(url: string): string | null {
  const path = url.replace(/^https:\/\/t\.me\//, "");
  return path.startsWith("+") ? null : "@" + path;
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
          {CHANNELS.map((c) => {
            const handle = handleOf(c.url);
            return (
            <a
              key={c.url}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-hairline bg-white/[0.02] px-5 py-4 transition-colors hover:border-[#2AABEE]/40 hover:bg-[#2AABEE]/[0.04]"
            >
              <TelegramIcon className="size-9 shrink-0 rounded-full bg-[#2AABEE]/15 p-2 text-[#2AABEE]" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-[15px] font-semibold">{c.name}</span>
                <span className="truncate text-[12px] text-dim">
                  {handle ? `${handle} · ${t(c.tagKey)}` : t(c.tagKey)}
                </span>
              </span>
              <span className="ml-auto text-[13px] text-dim transition-colors group-hover:text-[#2AABEE]">
                ↗
              </span>
            </a>
            );
          })}
        </div>
      </div>

      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="" />
    </main>
  );
}
