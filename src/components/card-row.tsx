import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AnimeCard } from "@/components/anime-card";
import { Reveal } from "@/components/reveal";
import { seasonLabel, type Row } from "@/lib/queries";

/** Горизонтальный ряд карточек со снап-скроллом — блок «rows» из макета. */
export async function CardRow({ row, index = 0 }: { row: Row; index?: number }) {
  const t = await getTranslations("home");
  const seasons = await getTranslations("seasons");

  // Сезонный ряд подписывается датой, остальные — обычным ключом.
  const heading = row.season
    ? t("season", { label: seasonLabel(seasons, row.season.key, row.season.year) })
    : t(row.key);

  return (
    <Reveal delayMs={(index % 5) * 55}>
      <section className="px-4 pb-2 pt-8 md:px-10">
        <div className="mb-[18px] flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-[21px] font-semibold tracking-[-0.02em]">
              {heading}
            </h2>
            {row.count !== null && (
              <span className="font-display text-xs tracking-[0.1em] text-dim">
                {t("titlesCount", { count: row.count })}
              </span>
            )}
          </div>
          <Link href={row.href} className="text-[13px] text-subtle transition-colors hover:text-accent">
            {t("seeAll")}
          </Link>
        </div>

        <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:gap-[18px] sm:px-0">
          {row.items.map((item, i) => (
            // Ширину задаёт ряд: карточка сама по себе тянется по контейнеру.
            <div key={item.id} className="w-[140px] shrink-0 sm:w-[186px]">
              <AnimeCard item={item} deg={150 + i * 6} />
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
