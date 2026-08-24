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

import { ANITAG_RU } from "./anitag-ru";

/**
 * Какой состав собираем. Варианты лежат рядом в VARIANTS, переключается
 * переменной окружения — так проверка не требует правки кода и, главное,
 * можно вернуться к предыдущему составу, чтобы перепроверить вывод:
 *
 *   EMBEDDING_VARIANT=v4 npm run embed
 *
 * Имя варианта попадает в embeddingHash и хранится в базе, поэтому смена
 * варианта сама по себе означает полный перегон, а probe видит, вектора
 * какого состава сейчас лежат.
 */
export const EMBEDDING_VERSION = process.env.EMBEDDING_VARIANT ?? "v3";

/** Модель. Размерность и тип колонки живут в vector.ts. */
export const EMBEDDING_MODEL = "voyage-4-lite";

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
  /// Метки AniList с рангами — см. модель AniTag.
  aniTags: { rank: number; tag: { name: string; category: string | null } }[];
};

/**
 * Разделы меток AniList, которые не про содержание: Rotoscoping и Stop Motion
 * это способ рисовать, а не тон истории. В вектор тона они попадать не должны.
 */
const SKIP_CATEGORIES = new Set(["Technical"]);

/**
 * Метки AniList по убыванию ранга.
 *
 * Ранг — доля пользователей, согласившихся, что метка подходит. Порядок по
 * нему ставит вперёд то, что описывает тайтл вернее всего, а хвост из
 * случайных совпадений обрезается ограничением сверху.
 */
function aniWords(t: EmbeddableTitle, take: number, russian = false): string[] {
  return t.aniTags
    .filter((x) => !SKIP_CATEGORIES.has(x.tag.category ?? ""))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, take)
    // Непереведённые метки остаются английскими: это 0.7% связей, сплошь
    // редкая экзотика и порнография. Ронять их вовсе хуже, чем оставить.
    .map((x) => (russian ? (ANITAG_RU[x.tag.name] ?? x.tag.name) : x.tag.name));
}

/**
 * Русские имена жанров.
 *
 * В Genre имена английские, а у меток с Shikimori есть русские (Tag.nameRu).
 * Каталог и запросы русские, и держать в одной строке «Экшен» рядом с
 * «Action» — значит тратить часть вектора на перевод вместо смысла.
 *
 * Таблица собрана по справочнику меток; девять последних — жанры, которые
 * Shikimori из справочника убрал, поэтому переведены вручную.
 */
const GENRE_RU: Record<string, string> = {
  "Action": "Экшен",
  "Adventure": "Приключения",
  "Award Winning": "Удостоено наград",
  "Cars": "Автомобили",
  "Comedy": "Комедия",
  "Dementia": "Психоделика",
  "Demons": "Демоны",
  "Drama": "Драма",
  "Ecchi": "Этти",
  "Erotica": "Эротика",
  "Fantasy": "Фэнтези",
  "Game": "Игры",
  "Girls Love": "Сёдзё-ай",
  "Gourmet": "Гурман",
  "Harem": "Гарем",
  "Hentai": "Хентай",
  "Historical": "Исторический",
  "Horror": "Ужасы",
  "Josei": "Дзёсей",
  "Kids": "Детское",
  "Martial Arts": "Боевые искусства",
  "Mecha": "Меха",
  "Military": "Военное",
  "Music": "Музыка",
  "Mystery": "Тайна",
  "Parody": "Пародия",
  "Police": "Полиция",
  "Psychological": "Психологическое",
  "Romance": "Романтика",
  "Samurai": "Самураи",
  "School": "Школа",
  "Sci-Fi": "Фантастика",
  "Seinen": "Сэйнэн",
  "Shoujo": "Сёдзё",
  "Shoujo Ai": "Сёдзё-ай",
  "Shounen": "Сёнен",
  "Shounen Ai": "Сёнэн-ай",
  "Slice of Life": "Повседневность",
  "Space": "Космос",
  "Sports": "Спорт",
  "Super Power": "Супер сила",
  "Supernatural": "Сверхъестественное",
  "Suspense": "Триллер",
  "Thriller": "Триллер",
  "Vampire": "Вампиры",
  "Work Life": "Работа",
  "Yaoi": "Яой",
  "Yuri": "Юри",
};

/**
 * Жанры и метки одним списком по-русски, без повторов.
 *
 * Метки идут первыми: их проставлял отдельный свежий прогон, тогда как Genre
 * остался от старого синка. Жанр берём, только если метки с таким же именем
 * у тайтла нет, — иначе одно слово попало бы дважды.
 */
function themeWords(t: EmbeddableTitle): string[] {
  const tagNames = new Set(t.tags.map((x) => x.name));
  return [
    ...new Set([
      ...t.tags.map((x) => x.nameRu ?? x.name),
      ...t.genres.filter((g) => !tagNames.has(g.name)).map((g) => GENRE_RU[g.name] ?? g.name),
    ]),
  ];
}

/**
 * Собирает текст, который уходит в модель.
 *
 * v1 — намеренно простая база: названия, жанры, сухие факты, описание.
 * v2 — то же плюс метки Shikimori. Синопсис почти никогда не говорит, что
 * история «тихая» или «жестокая», — он пересказывает завязку. Тон живёт в
 * метках: Iyashikei, Gore, Survival. Без них запрос про настроение ищет по
 * пересказу сюжета и промахивается.
 *
 * v3 — жанры и метки по-русски, а не по-английски.
 *
 * v2 дал меньше, чем ожидалось: перестановки в выдаче и сотые доли близости.
 * Похоже, десяток английских слов через запятую весит слишком мало против
 * пятисот символов русского синопсиса рядом. v3 проверяет первую половину
 * догадки — язык; вторая половина, вес, остаётся на следующий заход.
 */
/** Названия: русское, оригинальное, японское. */
function nameLine(t: EmbeddableTitle): string {
  return [t.titleRu, t.title, t.titleJp].filter(Boolean).join(" / ");
}

/** Сухие факты, которые вообще известны про тайтл. */
function factParts(t: EmbeddableTitle): string[] {
  return [t.format, t.year ? String(t.year) : null].filter((x): x is string => Boolean(x));
}

/** Жанры и метки английскими именами — как было в v1 и v2. */
function englishWords(t: EmbeddableTitle, withTags: boolean): string[] {
  return [...new Set([...t.genres.map((g) => g.name), ...(withTags ? t.tags.map((x) => x.name) : [])])];
}

/** Строка вида «Жанры и темы: ...» либо ничего, если перечислять нечего. */
function labeled(label: string, values: string[]): string | null {
  return values.length ? `${label}: ${values.join(", ")}` : null;
}

function assemble(parts: (string | null)[]): string {
  return parts.filter((x): x is string => Boolean(x)).join("\n");
}

/**
 * Составы. Каждый — отдельная проверка, и старые остаются рабочими, чтобы
 * можно было вернуться и пересобрать вывод, а не верить записи в блокноте.
 *
 * v1  названия, жанры по-английски, факты, описание — исходная база.
 * v2  плюс метки Shikimori, тоже по-английски.
 * v3  жанры и метки по-русски.
 * v4  только названия, темы и факты — описание выброшено.
 * v5  всё как в v3, но строка тем повторена четыре раза.
 *
 * Что уже известно по замерам (npm run compare): v2 и v3 не дали ничего —
 * порядка одного сменившегося тайтла из пяти и сотые доли балла. Значит,
 * дело не в наличии меток и не в их языке.
 *
 * v4 — не кандидат в прод, а диагностика. Если без описания тон-запросы
 * резко пойдут вверх, значит пятьсот символов синопсиса топят десяток слов
 * рядом и работать надо с весом. Если не пойдут — метки бесполезны сами по
 * себе, и искать надо другое.
 */
const VARIANTS: Record<string, (t: EmbeddableTitle) => string> = {
  v1: (t) =>
    assemble([
      nameLine(t),
      labeled("Жанры", englishWords(t, false)),
      labeled("Формат", factParts(t)),
      cleanSynopsis(t.synopsis) || null,
    ]),

  v2: (t) =>
    assemble([
      nameLine(t),
      labeled("Жанры и темы", englishWords(t, true)),
      labeled("Формат", factParts(t)),
      cleanSynopsis(t.synopsis) || null,
    ]),

  v3: (t) =>
    assemble([
      nameLine(t),
      labeled("Жанры и темы", themeWords(t)),
      labeled("Формат", factParts(t)),
      cleanSynopsis(t.synopsis) || null,
    ]),

  v4: (t) =>
    assemble([nameLine(t), labeled("Жанры и темы", themeWords(t)), labeled("Формат", factParts(t))]),

  // v5 — вторая диагностика, про вес. Модель усредняет токены, и десяток слов
  // тем против полутора сотен токенов синопсиса весят процентов шесть. Здесь
  // строка тем повторена четырежды — грубо, зато однозначно: если и так тон
  // не сдвинется, вес не при чём и искать надо дальше.
  v5: (t) => {
    const themes = labeled("Жанры и темы", themeWords(t));
    return assemble([
      themes,
      nameLine(t),
      themes,
      labeled("Формат", factParts(t)),
      themes,
      cleanSynopsis(t.synopsis) || null,
      themes,
    ]);
  },
};

/**
 * Двухвекторные составы: тайтл описывается двумя текстами, каждый едет в свой
 * вектор, а смешиваются они уже на запросе.
 *
 * Зачем: замеры v2–v5 показали, что один вектор обслуживает два разных
 * запроса и вынужден выбирать. «Что-нибудь тихое и уютное» — про настроение,
 * оно живёт в метках. «Детектив расследует убийства в городке» — про сюжет,
 * он живёт в описании. Пока оба текста прессуются в один вектор, любая правка
 * веса забирает у одного и отдаёт другому. Раздельно этого выбора нет:
 * метки больше не тонут в пятистах символах синопсиса, потому что синопсиса
 * рядом с ними нет вообще.
 *
 * t1 — первый заход: тон это голый список тем, сюжет это всё остальное.
 * Повторять темы, как в v5, здесь незачем — в своём векторе им не с чем
 * конкурировать.
 */
export const TWO_VECTOR_VARIANTS: Record<
  string,
  { tone: (t: EmbeddableTitle) => string; plot: (t: EmbeddableTitle) => string }
> = {
  t1: {
    tone: (t) => themeWords(t).join(", "),
    plot: (t) =>
      assemble([nameLine(t), labeled("Формат", factParts(t)), cleanSynopsis(t.synopsis) || null]),
  },

  // t2 — исправление t1. Там темы были вычищены из сюжетного текста, и стало
  // хуже: «Лагерь на свежем воздухе» на запросе «тихое и уютное» в составе v5
  // стоял вторым, а в t1 исчез из выдачи вовсе. Причина в том, что вектор
  // тона — грубый классификатор: различных текстов тона всего 5459 на 15583
  // тайтла, и 39% тайтлов сидят в группах по десять и больше (в самой крупной,
  // «Комедия», их 537). Внутри такой группы тон не различает ничего, порядок
  // решает сюжет — а из сюжета мы темы как раз и выкинули.
  //
  // Здесь сюжетный текст остаётся полным, как в v3, а вектор тона только
  // добавляет нажим. При весе 0 состав в точности повторяет v3.
  t2: {
    tone: (t) => themeWords(t).join(", "),
    plot: (t) =>
      assemble([
        nameLine(t),
        labeled("Жанры и темы", themeWords(t)),
        labeled("Формат", factParts(t)),
        cleanSynopsis(t.synopsis) || null,
      ]),
  },

  // t3 — тот же t2, но тон считается по меткам AniList вместо Shikimori.
  //
  // Причина в разрешении. У Shikimori 80 меток на весь каталог и по три на
  // тайтл: различных текстов тона выходит 5459 на 15583 тайтла, а в самой
  // крупной группе, «Комедия», их 537 с буквально одинаковым вектором. Внутри
  // такой группы тон не различает ничего. У AniList меток сотни и по
  // тринадцать на тайтл — на пробе в 500 тайтлов различных наборов оказалось
  // 492, то есть почти у каждого свой.
  //
  // Имена английские, а каталог русский. Это осознанно: перевод меток на
  // русский в составе v3 не дал ничего (сменился один тайтл из пяти), так что
  // мешать сюда ещё и язык незачем.
  //
  // Сюжетная половина не тронута — ровно как в t2. Между t2 и t3 меняется
  // одна вещь: откуда берётся тон.
  t3: {
    // Метки AniList есть не у всех: 1413 тайтлов он не знает вовсе, ещё у
    // пары тысяч все метки не дотянули до порога ранга. Без запасного
    // варианта эти 27% каталога остались бы вообще без тона — а метки
    // Shikimori у них есть, пусть и грубые. Лучше грубый тон, чем никакого.
    tone: (t) => {
      const ani = aniWords(t, 12);
      return (ani.length ? ani : themeWords(t)).join(", ");
    },
    plot: (t) =>
      assemble([
        nameLine(t),
        labeled("Жанры и темы", themeWords(t)),
        labeled("Формат", factParts(t)),
        cleanSynopsis(t.synopsis) || null,
      ]),
  },

  // t4 — тот же t3, но метки по-русски.
  //
  // Раньше перевод меток не давал ничего (v3: сменился один тайтл из пяти),
  // но там десяток слов тонул в пятистах символах русского синопсиса рядом.
  // В отдельном векторе тона рядом с ними нет ничего, и язык стал решать.
  // Замер на «Лагере на свежем воздухе»: один и тот же набор меток против
  // запроса «что-нибудь тихое и уютное, чтобы отдохнуть» даёт 0.320
  // по-английски и 0.466 по-русски.
  t4: {
    tone: (t) => {
      const ani = aniWords(t, 12, true);
      return (ani.length ? ani : themeWords(t)).join(", ");
    },
    plot: (t) =>
      assemble([
        nameLine(t),
        labeled("Жанры и темы", themeWords(t)),
        labeled("Формат", factParts(t)),
        cleanSynopsis(t.synopsis) || null,
      ]),
  },
};

/** Выбранный состав считает два вектора, а не один. */
export const IS_TWO_VECTOR = EMBEDDING_VERSION in TWO_VECTOR_VARIANTS;

/** Оба текста тайтла для двухвекторного состава. */
export function buildTwoTexts(t: EmbeddableTitle): { tone: string; plot: string } {
  const variant = TWO_VECTOR_VARIANTS[EMBEDDING_VERSION];
  if (!variant) {
    throw new Error(`состав «${EMBEDDING_VERSION}» не двухвекторный`);
  }
  return { tone: variant.tone(t), plot: variant.plot(t) };
}

/** Собирает текст, который уходит в модель, по выбранному составу. */
export function buildEmbeddingText(t: EmbeddableTitle): string {
  const variant = VARIANTS[EMBEDDING_VERSION];
  if (!variant) {
    const all = [...Object.keys(VARIANTS), ...Object.keys(TWO_VECTOR_VARIANTS)].join(", ");
    throw new Error(`неизвестный состав «${EMBEDDING_VERSION}», есть: ${all}`);
  }
  return variant(t);
}
