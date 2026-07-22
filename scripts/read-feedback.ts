/**
 * Читалка отзывов — админки на сайте нет, отзывы смотрим из консоли.
 *
 *   npm run feedback            последние 20
 *   npm run feedback -- 50      последние 50
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const take = Number(process.argv[2]) || 20;

  const rows = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true, email: true } } },
  });

  if (rows.length === 0) {
    console.log("Отзывов пока нет.");
    return;
  }

  console.log(`Всего в базе: ${await prisma.feedback.count()}, показаны последние ${rows.length}\n`);

  // От старых к новым — читать хронологично удобнее.
  for (const row of rows.reverse()) {
    const when = row.createdAt.toISOString().slice(0, 16).replace("T", " ");
    const who = row.user.name ?? row.user.email ?? row.userId;
    console.log(`--- ${when} · ${who} ---`);
    console.log(row.message);
    console.log();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
