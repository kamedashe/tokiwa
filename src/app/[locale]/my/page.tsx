import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { TitleGrid } from "@/components/title-grid";
import { ImportList } from "@/components/import-list";
import { FeedbackNudge } from "@/components/feedback-nudge";
import { TelegramConnect } from "@/components/telegram-connect";
import { getMyList, getNewEpisodes, getPlannedAiring } from "@/lib/watchlist";
import { importFromShikimori, importFromMalFile } from "@/lib/import-actions";
import { STATUS_ORDER } from "@/lib/watch-status";
import { formatDuration } from "@/lib/backlog";
import { telegramBotUsername } from "@/lib/telegram";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MyListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("myList");
  const s = await getTranslations("status");
  const c = await getTranslations("catalog");
  const f = await getTranslations("feedback");
  const time = await getTranslations("time");
  const grouped = await getMyList(locale);
  if (!grouped) redirect("/login?next=/my");

  const [newEpisodes, plannedAiring] = await Promise.all([
    getNewEpisodes(locale),
    getPlannedAiring(locale),
  ]);

  // Блок подключения бота появляется, только когда бот вообще настроен.
  let telegramLinked: boolean | null = null;
  if (telegramBotUsername()) {
    const session = await auth();
    const link = session?.user?.id
      ? await prisma.telegramLink.findUnique({
          where: { userId: session.user.id },
          select: { chatId: true },
        })
      : null;
    telegramLinked = Boolean(link?.chatId);
  }

  const tgLabels = {
    title: t("tgTitle"),
    text: t("tgText"),
    connect: t("tgConnect"),
    open: t("tgOpen"),
    linked: t("tgLinked"),
    unlink: t("tgUnlink"),
  };

  const nudgeLabels = {
    title: f("nudgeTitle"),
    text: f("nudgeText"),
    cta: f("nudgeCta"),
    close: f("nudgeClose"),
  };

  const total = STATUS_ORDER.reduce((sum, key) => sum + grouped[key].length, 0);

  if (total === 0) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="flex flex-col items-center gap-4 px-6 py-32 text-center">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("emptyTitle")}</h1>
          <p className="max-w-md text-muted">
            {t("emptyText")}
          </p>
          <Link
            href="/catalog"
            className="mt-2 rounded-full bg-accent px-6 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-accent-soft"
          >
            {t("toCatalog")}
          </Link>
        </div>

        <div className="pb-16">
          <ImportList importShikimori={importFromShikimori} importMal={importFromMalFile} />
        </div>

      <SiteFooter />
      <div className="h-20 md:hidden" />
      <MobileNav current="/my" />
    </main>
    );
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="px-4 pt-8 md:px-10">
        <div className="mb-2 flex items-baseline gap-3">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em]">{t("title")}</h1>
          <span className="font-display text-xs tracking-[0.1em] text-dim">
            {c("titlesCount", { count: total })}
          </span>
        </div>

        {/* Причины возвращаться: у «смотрю» вышли новые серии, а из
            «запланировано» что-то уже начало выходить. */}
        {(newEpisodes.length > 0 || plannedAiring.length > 0) && (
          <div className="mt-4 max-w-[720px] rounded-2xl border border-accent/25 bg-accent/[0.05] px-5 py-4">
            {newEpisodes.length > 0 && (
              <>
                <div className="font-display text-[12px] tracking-[0.14em] text-accent">
                  {t("newEpisodes").toUpperCase()}
                </div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {newEpisodes.map((e) => (
                    <Link
                      key={e.slug}
                      href={`/anime/${e.slug}`}
                      className="group flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                    >
                      <span className="font-display text-[14px] font-semibold transition-colors group-hover:text-accent">
                        {e.name}
                      </span>
                      <span className="text-[12px] text-muted">
                        {t("airedProgress", { progress: e.progress, aired: e.aired })}
                      </span>
                      {e.catchUpMin !== null && (
                        <span className="text-[12px] text-dim">
                          {t("catchUp", { time: formatDuration(time, e.catchUpMin) })}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </>
            )}

            {plannedAiring.length > 0 && (
              <>
                <div
                  className={`font-display text-[12px] tracking-[0.14em] text-accent ${
                    newEpisodes.length > 0 ? "mt-5 border-t border-accent/15 pt-4" : ""
                  }`}
                >
                  {t("startedAiring").toUpperCase()}
                </div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {plannedAiring.map((e) => (
                    <Link
                      key={e.slug}
                      href={`/anime/${e.slug}`}
                      className="group flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                    >
                      <span className="font-display text-[14px] font-semibold transition-colors group-hover:text-accent">
                        {e.name}
                      </span>
                      <span className="text-[12px] text-muted">
                        {t("airedCount", { count: e.aired })}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {STATUS_ORDER.filter((key) => grouped[key].length > 0).map((key) => (
        <TitleGrid
          key={key}
          heading={s(key)}
          subheading={`${grouped[key].length}`}
          items={grouped[key]}
          level={2}
          emptyText={c("nothingFound")}
        />
      ))}

      {/* Просьба о фидбеке — только у тех, кто реально ведёт список. */}
      <div className="mx-auto flex max-w-[720px] flex-col gap-3 px-4 pt-10 md:px-10">
        {telegramLinked !== null && (
          <TelegramConnect linked={telegramLinked} labels={tgLabels} />
        )}
        <FeedbackNudge labels={nudgeLabels} />
      </div>

      <div className="h-12" />
      <ImportList importShikimori={importFromShikimori} importMal={importFromMalFile} />

      <div className="h-16" />
      <div className="h-20 md:hidden" />
      <MobileNav current="/my" />
    </main>
  );
}
