/**
 * Сравнивает два сохранённых прогона probe и считает, что реально изменилось.
 *
 *   npx tsx scripts/compare.ts before.txt after.txt
 *
 * Глазами это не берётся: списки почти совпадают, баллы шевелятся в третьем
 * знаке, и очень хочется увидеть улучшение там, где его нет. Две цифры на
 * запрос — сколько тайтлов сменилось и куда поехал балл — врать не дают.
 */
import { readFileSync } from "node:fs";

type Block = { query: string; items: { score: number; title: string }[] };

function parse(path: string): Block[] {
  const blocks: Block[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const head = line.match(/^### (.+)$/);
    if (head) {
      blocks.push({ query: head[1], items: [] });
      continue;
    }
    const row = line.match(/^\s+([\d.]+)\s{2}(.+)$/);
    if (row && blocks.length) {
      blocks[blocks.length - 1].items.push({ score: Number(row[1]), title: row[2] });
    }
  }
  return blocks;
}

function main() {
  const [beforePath, afterPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) {
    console.error("нужны два файла: npx tsx scripts/compare.ts before.txt after.txt");
    process.exit(1);
  }

  const before = parse(beforePath);
  const after = parse(afterPath);
  const byQuery = new Map(before.map((b) => [b.query, b]));

  let changedTotal = 0;
  let deltaTotal = 0;
  let counted = 0;

  console.log("запрос".padEnd(52), "сменилось", "  топ-1");
  console.log("-".repeat(78));

  for (const a of after) {
    const b = byQuery.get(a.query);
    if (!b) continue;

    const wasTitles = new Set(b.items.map((i) => i.title));
    const fresh = a.items.filter((i) => !wasTitles.has(i.title)).length;
    const delta = (a.items[0]?.score ?? 0) - (b.items[0]?.score ?? 0);

    changedTotal += fresh;
    deltaTotal += delta;
    counted++;

    const sign = delta >= 0 ? "+" : "";
    console.log(
      a.query.slice(0, 50).padEnd(52),
      `${fresh}/${a.items.length}`.padStart(8),
      `  ${sign}${delta.toFixed(3)}`,
    );
  }

  console.log("-".repeat(78));
  const changedAvg = changedTotal / counted;
  const deltaAvg = deltaTotal / counted;
  console.log(
    `в среднем сменилось ${changedAvg.toFixed(2)} из 5, ` +
      `балл топ-1 ${deltaAvg >= 0 ? "+" : ""}${deltaAvg.toFixed(4)}`,
  );

  // Баллы сравнимы только между составами с похожей длиной документа. Если
  // из состава выкинули описание, вектора переехали в другую область, и
  // падение балла само по себе ничего не значит — смотреть надо на тайтлы.
  if (changedAvg < 1) {
    console.log("\nВыдача почти не тронулась — правка ничего не дала, как бы ни хотелось обратного.");
  } else if (changedAvg >= 2.5) {
    console.log("\nВыдача поменялась заметно. Дальше только глазами: цифра не скажет, стало лучше или хуже.");
  } else {
    console.log("\nСдвиг есть, но небольшой. Стоит посмотреть, на каких запросах именно.");
  }
}

main();
