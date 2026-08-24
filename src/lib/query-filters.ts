/**
 * Разбор структурных условий из строки поиска.
 *
 * «Что-нибудь тихое из 2020-х, только полнометражки, без гарема» — здесь три
 * условия и одно пожелание по смыслу. Условия должны стать обычным WHERE, а
 * вектору достаться только «что-нибудь тихое».
 *
 * Почему это нужно, если поиск и так смысловой: эмбеддинги плохо понимают
 * отрицание. «Магия без гарема» и «магия с гаремом» дают почти одинаковые
 * вектора — слово «гарем» есть в обоих, — и в выдачу лезет ровно то, от чего
 * человек отказывался. Год и формат вектору тоже вредят: цифры «2020» тянут
 * его к тайтлам, где эти цифры попались в описании.
 *
 * Поэтому найденное условие не просто запоминается, а вырезается из строки —
 * в модель уходит остаток.
 */

export type QueryFilters = {
  yearFrom?: number;
  yearTo?: number;
  formats?: string[];
  episodesMax?: number;
  episodesMin?: number;
  status?: string;
  scoreMin?: number;
  /** Имена меток AniList, тайтлы с которыми выбрасываются. */
  excludeTags?: string[];
};

export type ParsedQuery = {
  /** Остаток строки — то, что уходит в модель. */
  text: string;
  filters: QueryFilters;
  /** Что распознали, человеческим языком: для показа и отладки. */
  matched: string[];
};

/** Нужен для «свежего» и «последних лет». */
const THIS_YEAR = new Date().getUTCFullYear();

/**
 * Граница слова вручную.
 *
 * В JavaScript обычная граница слова определена через [A-Za-z0-9_], и
 * кириллица для неё не буква. Из-за этого правило вида «школ» с обычной
 * границей не находит «школьное», зато срабатывает посреди чужого слова. По
 * той же причине здесь везде класс букв, а не сокращение для слова.
 */
const BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const AFTER = String.raw`(?![\p{L}\p{N}])`;
/** Хвост слова: любые буквы после основы. */
const W = String.raw`\p{L}*`;

const rx = (body: string) => new RegExp(BEFORE + body + AFTER, "iu");

/**
 * Основы слов, по которым узнаём метку AniList. Сравнение по началу слова —
 * грубая замена морфологии: «гарем», «гарема», «гаремом» дают одну основу.
 *
 * Список намеренно короткий: сюда попадает только то, от чего люди
 * действительно отказываются вслух. Всё остальное вектор учитывает и сам.
 */
const TAG_STEMS: { stems: string[]; tags: string[]; label: string }[] = [
  { stems: ["гарем"], tags: ["Female Harem", "Male Harem", "Mixed Gender Harem"], label: "гарем" },
  { stems: ["этти", "эччи", "фансервис", "фан-сервис"], tags: ["Nudity", "Large Breasts"], label: "этти" },
  { stems: ["обнажен", "голых", "голые"], tags: ["Nudity"], label: "обнажённость" },
  { stems: ["школ"], tags: ["School", "School Club", "Boarding School"], label: "школа" },
  { stems: ["исекай", "исэкай", "попаданц"], tags: ["Isekai"], label: "исекай" },
  { stems: ["детск"], tags: ["Kids"], label: "детское" },
  { stems: ["робот", "меха"], tags: ["Robots", "Real Robot", "Super Robot"], label: "роботы" },
  { stems: ["зомби"], tags: ["Zombie"], label: "зомби" },
  { stems: ["кров", "жестокост", "расчлен"], tags: ["Gore", "Body Horror"], label: "жестокость" },
  { stems: ["спорт"], tags: ["Athletics"], label: "спорт" },
  { stems: ["маги"], tags: ["Magic"], label: "магия" },
  { stems: ["вампир"], tags: ["Vampire"], label: "вампиры" },
  { stems: ["идол"], tags: ["Idol"], label: "идолы" },
  { stems: ["изнасил"], tags: ["Rape"], label: "изнасилование" },
  { stems: ["инцест"], tags: ["Incest"], label: "инцест" },
  { stems: ["яой", "сенен-ай", "шонен-ай"], tags: ["Boys' Love"], label: "яой" },
  { stems: ["юри", "седзе-ай"], tags: ["Yuri"], label: "юри" },
  { stems: ["музыкальн"], tags: ["Band", "Idol", "Musical Theater"], label: "музыкальное" },
];

/** ё и е в запросах пишут как придётся. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

function findTags(phrase: string): { tags: string[]; label: string } | null {
  const p = normalize(phrase);
  return TAG_STEMS.find((e) => e.stems.some((stem) => p.startsWith(normalize(stem)))) ?? null;
}

type Rule = {
  re: RegExp;
  apply: (m: RegExpMatchArray, f: QueryFilters) => string;
};

/**
 * Порядок важен: конкретные формулировки идут раньше общих, иначе правило про
 * год съест «2020» внутри «2020-х», а «короткое» сработает на
 * «короткометражке».
 */
const RULES: Rule[] = [
  // --- Годы ---
  {
    // «2020-х», «90-х годов»
    re: rx(String.raw`(19|20)?(\d0)[-\s]?[хx](?:\s+год${W})?`),
    apply: (m, f) => {
      // Двузначное: 90-е — это девяностые, 20-е — двадцатые нашего века.
      const century = m[1] ? Number(m[1]) * 100 : Number(m[2]) >= 30 ? 1900 : 2000;
      const from = century + Number(m[2]);
      f.yearFrom = from;
      f.yearTo = from + 9;
      return `${from}-е`;
    },
  },
  {
    re: rx(String.raw`(?:после|начиная\s+с|новее|с)\s+((?:19|20)\d{2})(?:\s+год${W})?`),
    apply: (m, f) => ((f.yearFrom = Number(m[1])), `с ${m[1]}`),
  },
  {
    re: rx(String.raw`(?:до|раньше|старше)\s+((?:19|20)\d{2})(?:\s+год${W})?`),
    apply: (m, f) => ((f.yearTo = Number(m[1])), `до ${m[1]}`),
  },
  {
    re: rx(String.raw`((?:19|20)\d{2})(?:\s+год${W})?`),
    apply: (m, f) => ((f.yearFrom = f.yearTo = Number(m[1])), `${m[1]} год`),
  },
  {
    re: rx(String.raw`(?:свеж${W}|новинк${W}|последних\s+лет|недавн${W})`),
    apply: (_m, f) => ((f.yearFrom = THIS_YEAR - 3), `не старше ${THIS_YEAR - 3}`),
  },
  {
    re: rx(String.raw`(?:стар[аоыи]${W}|классик${W}|древн${W}|ретро)`),
    apply: (_m, f) => ((f.yearTo = 2005), "старое, до 2005"),
  },

  // --- Формат ---
  {
    // Раньше «короткого»: короткометражка — это фильм, а не сериал на 13 серий.
    re: rx(String.raw`(?:короткометраж${W})`),
    apply: (_m, f) => ((f.formats = ["Movie"]), "формат: короткометражка"),
  },
  {
    re: rx(String.raw`(?:полнометраж${W}|полный\s+метр|фильм${W}|кино)`),
    apply: (_m, f) => ((f.formats = ["Movie"]), "формат: фильм"),
  },
  {
    re: rx(String.raw`(?:тв[-\s]?сериал${W}|сериал${W})`),
    apply: (_m, f) => ((f.formats = ["TV"]), "формат: сериал"),
  },
  {
    re: rx(String.raw`(?:ova|ова)`),
    apply: (_m, f) => ((f.formats = ["OVA"]), "формат: OVA"),
  },
  {
    re: rx(String.raw`(?:ona|веб[-\s]?сериал${W})`),
    apply: (_m, f) => ((f.formats = ["ONA"]), "формат: ONA"),
  },
  {
    re: rx(String.raw`(?:спецвыпуск${W}|спешл${W})`),
    apply: (_m, f) => ((f.formats = ["Special"]), "формат: спецвыпуск"),
  },

  // --- Длина ---
  {
    re: rx(String.raw`(?:до|не\s+больше|максимум)\s+(\d{1,3})\s*(?:сери${W}|эпизод${W})`),
    apply: (m, f) => ((f.episodesMax = Number(m[1])), `не больше ${m[1]} серий`),
  },
  {
    re: rx(String.raw`(?:от|не\s+меньше|минимум)\s+(\d{1,3})\s*(?:сери${W}|эпизод${W})`),
    apply: (m, f) => ((f.episodesMin = Number(m[1])), `не меньше ${m[1]} серий`),
  },
  {
    re: rx(String.raw`(?:коротк${W}|небольш${W}|на\s+один\s+вечер)`),
    apply: (_m, f) => ((f.episodesMax = 13), "не больше 13 серий"),
  },
  {
    re: rx(String.raw`(?:длинн${W}|многосерийн${W})`),
    apply: (_m, f) => ((f.episodesMin = 50), "от 50 серий"),
  },

  // --- Статус ---
  {
    re: rx(String.raw`(?:онгоинг${W}|выходит\s+сейчас|сейчас\s+выходит|текущ${W}\s+сезон${W})`),
    apply: (_m, f) => ((f.status = "releasing"), "сейчас выходит"),
  },
  {
    re: rx(String.raw`(?:заверш[её]нн?${W}|законченн${W}|полностью\s+вышл${W})`),
    apply: (_m, f) => ((f.status = "finished"), "завершённое"),
  },
  {
    re: rx(String.raw`(?:анонсированн${W}|ещ[её]\s+не\s+вышл${W})`),
    apply: (_m, f) => ((f.status = "not_yet_aired"), "ещё не вышло"),
  },

  // --- Оценка ---
  {
    re: rx(String.raw`(?:высок${W}\s+(?:оценк${W}|рейтинг${W})|лучш${W}|шедевр${W})`),
    apply: (_m, f) => ((f.scoreMin = 8), "оценка от 8"),
  },
];

/**
 * Отрицания разбираем отдельно: они забирают следующее слово, а не
 * фиксированную формулировку. «Без гарема», «кроме школьного», «не детское».
 *
 * Если слово после отрицания ни на что не похоже — «не знаю что посмотреть», —
 * правило молчит и строка остаётся как была.
 */
const NEGATION = new RegExp(
  BEFORE + String.raw`(?:без|кроме|не)\s+(\p{L}[\p{L}-]{2,})`,
  "giu",
);

/** Обрывки, остающиеся после вырезаний: висящие предлоги и пустые перечисления. */
const LEFTOVERS: [RegExp, string][] = [
  [/\s+/g, " "],
  [/\s*,\s*(?=,)/g, ""],
  [new RegExp(BEFORE + String.raw`(?:из|в|за|про|только|лишь|и|с)(?=\s*[,;]|\s*$)`, "giu"), ""],
  [/^[\s,;-]+|[\s,;-]+$/g, ""],
  [/\s+/g, " "],
];

export function parseQuery(raw: string): ParsedQuery {
  const filters: QueryFilters = {};
  const matched: string[] = [];
  let text = raw;

  // Отрицания первыми: иначе «не старое» разберётся как «старое», а «не
  // больше 12 серий» потеряет своё «не».
  text = text.replace(NEGATION, (whole, phrase: string) => {
    const hit = findTags(phrase);
    if (!hit) return whole;
    filters.excludeTags = [...new Set([...(filters.excludeTags ?? []), ...hit.tags])];
    matched.push(`без: ${hit.label}`);
    return " ";
  });

  for (const rule of RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    matched.push(rule.apply(m, filters));
    text = text.replace(rule.re, " ");
  }

  // Чистим до тех пор, пока строка меняется: убрав последнее слово, обрывок
  // вроде «что-то и с» оставляет висеть уже предыдущий предлог, и одного
  // прохода не хватает.
  for (let pass = 0; pass < 3; pass++) {
    const before = text;
    for (const [re, to] of LEFTOVERS) text = text.replace(re, to);
    if (text === before) break;
  }

  return { text: text.trim(), filters, matched };
}
