import { AnimeCard } from "@/components/anime-card";
import type { CardTitle } from "@/lib/queries";

/** Сетка карточек. Заголовок опционален: на каталоге он рендерится выше
 *  фильтров, поэтому страница рисует его сама. */
export function TitleGrid({
  heading,
  subheading,
  items,
  level = 1,
}: {
  heading?: string;
  subheading?: string;
  items: CardTitle[];
  /** На /my сетки идут секциями внутри страницы, там заголовок должен быть h2. */
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <div className="px-4 pb-8 md:px-10">
      {heading && (
        <div className="mb-7 flex items-baseline gap-3 pt-8">
          <Heading className="font-display text-[28px] font-bold tracking-[-0.03em]">
            {heading}
          </Heading>
          {subheading && (
            <span className="font-display text-xs tracking-[0.1em] text-dim">{subheading}</span>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-subtle">Ничего не нашлось.</p>
      ) : (
        // Сетка вместо flex-wrap: колонки ровные, а на телефоне их две
        // вместо одинокой карточки посреди пустоты.
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-[18px]">
          {items.map((item, i) => (
            <AnimeCard key={item.id} item={item} deg={150 + (i % 8) * 6} />
          ))}
        </div>
      )}
    </div>
  );
}
