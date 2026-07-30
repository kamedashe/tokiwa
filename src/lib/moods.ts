/**
 * Подборки по настроению — «что посмотреть под состояние души».
 *
 * Выбирать по длине и жанру умеют все, а выбирать под настроение — нет,
 * хотя именно так люди и решают: хочется поплакать, посмеяться или чтобы
 * ничего не грузило. Отсюда же поисковый спрос вроде «аниме чтобы поплакать».
 *
 * Соответствие подобрано вручную. Одних включающих жанров мало: без списка
 * исключений в «Лёгкое» лезут драмы со «Slice of Life», а в «Стеклище» —
 * комедии с одной драматичной аркой. Оценка отсекает случайный хлам, которого
 * в каталоге на 15 тысяч тайтлов хватает.
 */

export interface Mood {
  slug: string;
  /** Хотя бы один из этих жанров. */
  include: string[];
  /** Ни одного из этих. */
  exclude: string[];
  /** Ниже этой оценки в подборку не берём. */
  minScore: number;
}

/** Всегда лишнее в подборке «под настроение». */
const NSFW = ["Hentai", "Erotica", "Ecchi"];

export const MOODS: Mood[] = [
  {
    slug: "light",
    include: ["Slice of Life", "Work Life", "Gourmet", "Iyashikei"],
    exclude: [...NSFW, "Horror", "Thriller", "Psychological", "Dementia", "Military", "Drama"],
    minScore: 6.5,
  },
  {
    slug: "funny",
    include: ["Comedy", "Parody"],
    exclude: [...NSFW, "Horror", "Thriller", "Psychological", "Dementia"],
    minScore: 7,
  },
  {
    slug: "sad",
    include: ["Drama"],
    exclude: [...NSFW, "Comedy", "Parody", "Kids"],
    minScore: 7,
  },
  {
    slug: "romance",
    include: ["Romance", "Shoujo", "Josei"],
    exclude: [...NSFW, "Harem", "Kids"],
    minScore: 6.8,
  },
  {
    slug: "tense",
    include: ["Thriller", "Mystery", "Suspense", "Horror"],
    exclude: [...NSFW, "Kids"],
    minScore: 6.8,
  },
  {
    slug: "mind",
    include: ["Psychological", "Dementia", "Sci-Fi"],
    exclude: [...NSFW, "Kids"],
    minScore: 7.2,
  },
];

export function moodBySlug(slug: string): Mood | undefined {
  return MOODS.find((m) => m.slug === slug);
}
