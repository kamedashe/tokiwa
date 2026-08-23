/**
 * Что именно мы превращаем в вектор.
 *
 * Это единственное место, где решается состав эмбеддинга, и главный рычаг
 * качества поиска: модель одна и та же, а выдача меняется до неузнаваемости
 * от того, что мы ей скормили. Поэтому состав живёт отдельной чистой
 * функцией — её можно менять, не трогая ни клиент API, ни прогон каталога.
 *
 * При любой правке состава поднимать EMBEDDING_VERSION: она входит в хеш,
 * по которому прогон решает, что перевекторизовать. Не поднять — значит
 * оставить в базе вектора от старого состава и часами гадать, почему
 * изменения ни на что не влияют.
 */

/** Версия состава. Меняется вместе с buildEmbeddingText. */
export const EMBEDDING_VERSION = "v2";

/** Модель и размерность вектора. Размерность зашита в схему БД (vector(1024)). */
export const EMBEDDING_MODEL = "voyage-4-lite";
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * Разметка Shikimori. В текущем дампе её нет — описания уже чистые, — но
 * синк тянет исходники дальше, и первый же тайтл с [b] отравит свой вектор
 * служебным словом. Дешевле держать чистку, чем ловить это в выдаче.
 */
const BBCODE_WITH_CONTENT = /\[(img|video|poster)\b[^\]]*\][\s\S]*?\[\/\1\]/gi;
const BBCODE_TAGS = /\[\/?(?:b|i|u|s|em|strong|url|link|character|anime|manga|ranobe|person|spoiler|quote|right|center|size|color|list|entry|br|div|smiley)\b[^\]]*\]/gi;

/**
 * Аннотации с именами — главный мусор в этом каталоге: 4145 вставок вида
 * «братья Эдвард [エドワード・エルリック] и Альфонс». Для человека это подсказка,
 * для эмбеддинга — обрывок японского посреди русской фразы, который тянет
 * вектор к «японскому языку» вместо смысла.
 */
const JAPANESE = /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿＀-￯]/;
const BRACKETED = /\[([^\[\]]{1,60})\]/g;
/** Тот же приём круглыми скобками: «Шана (シャナ)», «Казуми (吉田一美)». */
const PARENTHESIZED = /\(([^()]{1,60})\)/g;
/** Романдзи-имя в скобках: «[Conan Edogawa]», «[Luffy Monkey D.]». */
const ROMAJI_NAME = /^[A-Z][A-Za-z]*(?:[ .'-]+[A-Za-z][A-Za-z]*\.?)*\.?$/;

/**
 * Вики-ссылки Shikimori: «[[Отец]] Дзюго», «[[Однажды]] в сказке». Внутри
 * осмысленное слово из фразы, поэтому снимаем только обёртку — 531 штука.
 */
const WIKI_LINK = /\[\[([^\[\]]{1,60})\]\]/g;

/** Хвосты вида «Источник: Wikipedia», «(с) Кто-то». */
const SOURCE_NOTE = /(?:^|\n)\s*(?:источник|source|перевод|(?:\(|\[)?[cс©](?:\)|\])?)\s*[:—-].*$/gim;

/**
 * Приводит описание к тому виду, в каком его должна увидеть модель:
 * связный текст без служебных вставок.
 */
export function cleanSynopsis(raw: string | null | undefined): string {
  if (!raw) return "";

  let text = raw
    .replace(WIKI_LINK, "$1")
    .replace(BBCODE_WITH_CONTENT, " ")
    .replace(BBCODE_TAGS, " ")
    .replace(SOURCE_NOTE, " ");

  // Скобки убираем только там, где внутри аннотация: японские знаки или
  // латинское имя. Всё остальное — часть авторского текста, например
  // «[Это был первый раз...]», и трогать его нельзя.
  text = text.replace(BRACKETED, (whole, inner: string) => {
    const t = inner.trim();
    if (JAPANESE.test(t)) return " ";
    if (t.length <= 40 && ROMAJI_NAME.test(t)) return " ";
    return whole;
  });

  // В круглых скобках убираем только японские вставки: латиницей там часто
  // осмысленное уточнение вроде «(ТВ-версия)», и его надо сохранить.
  text = text.replace(PARENTHESIZED, (whole, inner: string) =>
    JAPANESE.test(inner) ? " " : whole,
  );

  return (
    text
      .replace(/\s*\n\s*/g, "\n")
      // [^\S\n] — любой пробельный символ, кроме перевода строки: в текстах
      // с Shikimori попадаются неразрывные пробелы.
      .replace(/[^\S\n]+/g, " ")
      // Вырезанная аннотация оставляет за собой висящий пробел перед знаком
      // препинания — модель видит рваную фразу «с Лурией , таинственной».
      .replace(/ +([,.;:!?…»)\]])/g, "$1")
      .replace(/([«(\[]) +/g, "$1")
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}

export type EmbeddableTitle = {
  title: string;
  titleRu: string | null;
  titleJp: string | null;
  synopsis: string | null;
  year: number | null;
  format: string | null;
  status: string | null;
  episodesCount: number | null;
  genres: { name: string }[];
  /// Метки Shikimori: theme и demographic сверх жанров — см. модель Tag.
  tags: { name: string; nameRu: string | null; kind: string }[];
};

/**
 * Собирает текст, который уходит в модель.
 *
 * v1 — намеренно простая база: названия, жанры, сухие факты, описание.
 * v2 — то же плюс метки Shikimori. Синопсис почти никогда не говорит, что
 * история «тихая» или «жестокая», — он пересказывает завязку. Тон живёт в
 * метках: Iyashikei, Gore, Survival. Без них запрос про настроение ищет по
 * пересказу сюжета и промахивается.
 *
 * Имена меток тут английские — ровно как жанры в v1. Это осознанно: между
 * v1 и v2 меняется одна вещь, наличие меток. Перевод имён на русский — это
 * отдельная проверка, и мешать её с этой нельзя, иначе непонятно, что
 * сработало (nameRu для неё уже лежит в базе).
 */
export function buildEmbeddingText(t: EmbeddableTitle): string {
  const names = [t.titleRu, t.title, t.titleJp].filter(Boolean).join(" / ");

  // Метки перекрывают жанры: Shikimori отдаёт kind="genre" тоже, и в базе
  // они уже есть. Set убирает дубли, порядок — жанры первыми.
  const genres = [...new Set([...t.genres.map((g) => g.name), ...t.tags.map((x) => x.name)])].join(", ");
  const facts = [t.format, t.year ? String(t.year) : null].filter(Boolean).join(", ");

  return [
    names,
    genres && `Жанры и темы: ${genres}`,
    facts && `Формат: ${facts}`,
    cleanSynopsis(t.synopsis),
  ]
    .filter(Boolean)
    .join("\n");
}
