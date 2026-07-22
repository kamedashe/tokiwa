/**
 * Живая статистика продукта: регистрации, списки, прогресс, возвраты.
 * Отвечает на вопрос «пользуются ли сайтом на самом деле».
 *
 *   npm run stats
 */
import { prisma } from "../src/lib/prisma";

function day(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [users, usersToday, entries, entriesToday, withProgress, feedback] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.watchlistEntry.count(),
    prisma.watchlistEntry.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.watchlistEntry.count({ where: { progress: { gt: 0 } } }),
    prisma.feedback.count(),
  ]);

  const usersWithList = (await prisma.watchlistEntry.groupBy({ by: ["userId"] })).length;

  console.log("=== ПОЛЬЗОВАТЕЛИ ===");
  console.log(`всего: ${users} | за сутки: +${usersToday}`);
  console.log(`завели список (≥1 тайтл): ${usersWithList}`);

  console.log("\n=== СПИСКИ ===");
  console.log(`записей: ${entries} | за сутки: +${entriesToday}`);
  console.log(`с прогрессом по сериям: ${withProgress}`);
  if (usersWithList > 0) {
    console.log(`средний список: ${(entries / usersWithList).toFixed(1)} тайтлов`);
  }

  const byStatus = await prisma.watchlistEntry.groupBy({ by: ["status"], _count: true });
  console.log("\n=== ПО СТАТУСАМ ===");
  for (const s of byStatus) console.log(`  ${s.status}: ${s._count}`);

  console.log(`\n=== ФИДБЕК ===\nотзывов: ${feedback}`);

  // --- Возвраты: активность списка в дни после дня регистрации ---
  const all = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      watchlist: { select: { createdAt: true, updatedAt: true } },
    },
  });

  const eligible = all.filter((u) => u.createdAt < dayAgo);
  let returned = 0;

  console.log("\n=== ВОЗВРАТЫ ===");
  for (const u of all) {
    const regDay = day(u.createdAt);
    const later = new Set<string>();
    for (const e of u.watchlist) {
      for (const d of [day(e.createdAt), day(e.updatedAt)]) {
        if (d > regDay) later.add(d);
      }
    }
    if (later.size > 0) {
      returned++;
      console.log(`  ↩ ${u.name ?? u.id.slice(0, 8)}: рег ${regDay}, вернулся ${[...later].sort().join(", ")}`);
    }
  }
  console.log(`могли вернуться (рег >24ч назад): ${eligible.length}`);
  console.log(`вернулись в другой день: ${returned}`);

  console.log("\n=== РЕГИСТРАЦИИ ПО ДНЯМ ===");
  const byDay: Record<string, number> = {};
  for (const u of all) byDay[day(u.createdAt)] = (byDay[day(u.createdAt)] ?? 0) + 1;
  for (const [d, n] of Object.entries(byDay).sort()) console.log(`  ${d}: ${n}`);

  // --- Топ добавляемых тайтлов ---
  const top = await prisma.watchlistEntry.groupBy({
    by: ["titleId"],
    _count: true,
    orderBy: { _count: { titleId: "desc" } },
    take: 8,
  });
  console.log("\n=== ЧАЩЕ ВСЕГО ДОБАВЛЯЮТ ===");
  for (const t of top) {
    const title = await prisma.title.findUnique({
      where: { id: t.titleId },
      select: { titleRu: true, title: true },
    });
    console.log(`  ${t._count}× ${title?.titleRu ?? title?.title}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
