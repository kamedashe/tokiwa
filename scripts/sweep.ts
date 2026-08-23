/**
 * Показывает, как вес тона двигает выдачу.
 *
 *   npm run sweep                             весь набор проб
 *   npm run sweep -- "что-нибудь тихое"       один запрос подробно
 *
 * Вес — это доля тона в итоговой близости: 0 значит искать только по
 * описанию, 1 — только по жанрам и темам. Правильного числа тут нет и быть
 * не может, оно зависит от того, чего от поиска ждут. Зато видно, где выдача
 * перестаёт меняться и где начинает разваливаться.
 */
import { prisma } from "../src/lib/prisma";
import { PROBES } from "../src/lib/probe-queries";
import { searchByVector } from "../src/lib/semantic-search";
import { embedTexts } from "../src/lib/voyage";

const WEIGHTS = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1];
const TOP = 5;

/** Сколько тайтлов из топа отличается от выдачи по одному только сюжету. */
function movedFrom(base: string[], now: string[]): number {
  const was = new Set(base);
  return now.filter((t) => !was.has(t)).length;
}

async function one(query: string) {
  const [vector] = await embedTexts([query], "query");
  console.log(`«${query}»\n`);

  for (const w of WEIGHTS) {
    const rows = await searchByVector(vector, TOP, w);
    console.log(`  вес тона ${w.toFixed(2)}`);
    for (const r of rows) {
      console.log(`      ${(1 - r.distance).toFixed(3)}  ${r.titleRu ?? r.title}${r.year ? ` (${r.year})` : ""}`);
    }
    console.log();
  }
}

async function all() {
  const vectors = await embedTexts(PROBES, "query");

  // База сравнения — поиск только по сюжету, то есть то, что было до второго
  // вектора. Дальше видно, насколько тон вообще способен что-то сдвинуть.
  const base: string[][] = [];
  for (const v of vectors) {
    base.push((await searchByVector(v, TOP, 0)).map((r) => r.titleRu ?? r.title));
  }

  console.log("сменилось тайтлов из топ-5 по сравнению с поиском только по сюжету\n");
  console.log("вес".padEnd(6), PROBES.map((_, i) => String(i + 1).padStart(3)).join(""), "  среднее");
  console.log("-".repeat(6 + PROBES.length * 3 + 10));

  for (const w of WEIGHTS) {
    const moved: number[] = [];
    for (const [i, v] of vectors.entries()) {
      const rows = await searchByVector(v, TOP, w);
      moved.push(movedFrom(base[i], rows.map((r) => r.titleRu ?? r.title)));
    }
    const avg = moved.reduce((a, b) => a + b, 0) / moved.length;
    console.log(w.toFixed(2).padEnd(6), moved.map((m) => String(m).padStart(3)).join(""), `  ${avg.toFixed(2)}`);
  }

  console.log("\nномера запросов:");
  PROBES.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p}`));
  console.log("\nПодробно по одному: npm run sweep -- \"<запрос>\"");
}

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  const query = process.argv.slice(2).join(" ").trim();
  if (query) await one(query);
  else await all();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
