/**
 * Заливка выгрузки обратно в базу — та, что указана в DATABASE_URL.
 *
 *   npm run restore -- backups/2026-08-18T07-40
 *
 * Пишет только в пустые таблицы: если в целевой базе уже что-то есть,
 * скрипт останавливается. Заливать поверх живых данных нельзя — так теряют
 * то, что накопилось после выгрузки.
 *
 * Порядок таблиц берётся из manifest.json: сначала те, на кого ссылаются.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

/** Поля дат приходят строками — Prisma ждёт Date. */
const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "syncedAt",
  "relatedSyncedAt",
  "nextEpisodeAt",
  "emailVerified",
  "expires",
  "codeExpiresAt",
  "digestSentAt",
]);

/** chatId у Telegram — BigInt, в JSON он строкой. */
const BIGINT_FIELDS = new Set(["chatId"]);

function revive(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      out[key] = value;
    } else if (DATE_FIELDS.has(key) && typeof value === "string") {
      out[key] = new Date(value);
    } else if (BIGINT_FIELDS.has(key) && typeof value === "string") {
      out[key] = BigInt(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function main() {
  const dir = process.argv[2];
  if (!dir || !existsSync(join(dir, "manifest.json"))) {
    console.error("Укажите папку выгрузки: npm run restore -- backups/<дата>");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
    order: string[];
    counts: Record<string, number>;
  };

  // Защита от заливки поверх живых данных.
  const existingTitles = await prisma.title.count();
  const existingUsers = await prisma.user.count();
  if (existingTitles > 0 || existingUsers > 0) {
    console.error(
      `База не пуста (тайтлов ${existingTitles}, пользователей ${existingUsers}). ` +
        "Восстановление отменено, чтобы не затереть данные.",
    );
    process.exit(1);
  }

  console.log(`Восстанавливаю из ${dir}\n`);

  for (const table of manifest.order) {
    const file = join(dir, `${table}.json`);
    if (!existsSync(file)) continue;

    const rows = (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>[]).map(revive);
    if (rows.length === 0) {
      console.log(`  ${table.padEnd(20)} пусто`);
      continue;
    }

    const model = (prisma as unknown as Record<
      string,
      { createMany: (args: { data: unknown[]; skipDuplicates: boolean }) => Promise<{ count: number }> }
    >)[table];

    // Порциями: пятнадцать тысяч тайтлов одним запросом не проходят.
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const res = await model.createMany({ data: chunk, skipDuplicates: true });
      inserted += res.count;
    }
    console.log(`  ${table.padEnd(20)} ${String(inserted).padStart(6)} строк`);
  }

  // Связи «многие ко многим» — сырым SQL, у неявных таблиц нет модели.
  for (const [file, table] of [
    ["_GenreToTitle.json", "_GenreToTitle"],
    ["_TitleRelations.json", "_TitleRelations"],
  ] as const) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;

    const pairs = JSON.parse(readFileSync(path, "utf8")) as { A: number; B: number }[];
    for (let i = 0; i < pairs.length; i += 1000) {
      const chunk = pairs.slice(i, i + 1000);
      const values = chunk.map((p) => `(${p.A},${p.B})`).join(",");
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${table}" ("A","B") VALUES ${values} ON CONFLICT DO NOTHING`,
      );
    }
    console.log(`  ${table.padEnd(20)} ${String(pairs.length).padStart(6)} связей`);
  }

  console.log("\nГотово.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
