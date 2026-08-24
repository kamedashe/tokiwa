/**
 * Показывает, во что разбирается строка поиска: что стало условием, а что
 * досталось модели.
 *
 *   npm run parse -- "тихое из 2020-х, только полнометражки, без гарема"
 *   npm run parse                      прогнать набор проб
 */
import { parseQuery } from "../src/lib/query-filters";

const SAMPLES = [
  "что-нибудь тихое из 2020-х, только полнометражки",
  "аниме про магию без гарема",
  "короткое фэнтези, не детское",
  "детектив 90-х годов",
  "что-то свежее и с высокой оценкой",
  "длинный сериал про пиратов",
  "старая классика про роботов, кроме меха",
  "романтика до 12 серий, завершённое",
  "исекай после 2020, без этти",
  "грустная история про взросление",
];

function show(q: string) {
  const { text, filters, matched } = parseQuery(q);
  console.log(`\n«${q}»`);
  console.log(`  в модель:  «${text}»`);
  console.log(`  условия:   ${matched.length ? matched.join("; ") : "нет"}`);
  const f = Object.entries(filters).filter(([, v]) => v !== undefined);
  if (f.length) console.log(`  фильтры:   ${f.map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : v}`).join(", ")}`);
}

const arg = process.argv.slice(2).join(" ").trim();
if (arg) show(arg);
else SAMPLES.forEach(show);
