/**
 * Полная выгрузка базы в JSON.
 *
 *   npm run backup            → backups/<дата>/
 *   npm run backup -- путь    → в указанную папку
 *
 * Своя выгрузка вместо pg_dump: тот требует установленного PostgreSQL, а на
 * рабочей машине его нет. JSON заодно читается глазами и переносится в любую
 * базу — привязки к диалекту Postgres в файлах нет.
 *
 * Порядок таблиц в MANIFEST — порядок восстановления: сначала те, на кого
 * ссылаются, потом ссылающиеся, иначе внешние ключи не дадут вставить.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

/** Что выгружаем и в каком порядке восстанавливать. */
const MANIFEST = [
  "genre",
  "title",
  "syncState",
  "user",
  "account",
  "session",
  "verificationToken",
  "watchlistEntry",
  "telegramLink",
  "feedback",
  "pollAnswer",
  "pushSubscription",
] as const;

/** BigInt (chatId в Telegram) в JSON не сериализуется — пишем строкой. */
function replacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const dir = process.argv[2] ?? join("backups", stamp);
  mkdirSync(dir, { recursive: true });

  console.log(`Выгружаю в ${dir}\n`);
  const counts: Record<string, number> = {};

  for (const table of MANIFEST) {
    // Prisma-клиент индексируется именем модели в camelCase.
    const model = (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[
      table
    ];
    const rows = await model.findMany();
    counts[table] = rows.length;

    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, replacer, 0), "utf8");
    console.log(`  ${table.padEnd(20)} ${String(rows.length).padStart(6)} строк`);
  }

  // Связи «многие ко многим» лежат в неявных таблицах, findMany их не отдаёт:
  // выгружаем парами id, иначе франшизы и жанры после восстановления пропадут.
  const titleGenres = await prisma.$queryRaw<{ A: number; B: number }[]>`
    SELECT "A", "B" FROM "_GenreToTitle"`;
  writeFileSync(join(dir, "_GenreToTitle.json"), JSON.stringify(titleGenres), "utf8");
  console.log(`  ${"_GenreToTitle".padEnd(20)} ${String(titleGenres.length).padStart(6)} связей`);

  const relations = await prisma.$queryRaw<{ A: number; B: number }[]>`
    SELECT "A", "B" FROM "_TitleRelations"`;
  writeFileSync(join(dir, "_TitleRelations.json"), JSON.stringify(relations), "utf8");
  console.log(`  ${"_TitleRelations".padEnd(20)} ${String(relations.length).padStart(6)} связей`);

  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      { createdAt: new Date().toISOString(), order: MANIFEST, counts },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\nГотово. Восстановление: npm run restore -- ${dir}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
