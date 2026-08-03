/**
 * Живая статистика продукта: кто пришёл, кто пользуется, кто возвращается.
 * Отвечает на вопрос «пользуются ли сайтом на самом деле».
 *
 *   npm run stats
 *
 * Возвраты считаются по датам изменения записей в списке. У этого метода два
 * известных ограничения, и оба честнее назвать, чем замалчивать:
 *   1. Заход без действий не виден — реальная доля возвратов выше;
 *   2. 28.07.2026 служебный скрипт освежил метки у 168 записей, поэтому это
 *      окно из подсчёта исключается (см. ARTIFACT_*).
 */
import { prisma } from "../src/lib/prisma";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Окно служебного прогона, чьи метки нельзя принимать за визиты людей. */
const ARTIFACT_FROM = new Date("2026-07-28T08:00:00Z");
const ARTIFACT_TO = new Date("2026-07-28T08:40:00Z");

const isArtifact = (d: Date) => d >= ARTIFACT_FROM && d <= ARTIFACT_TO;

function bar(value: number, max: number, width = 24): string {
  if (max <= 0) return "";
  return "█".repeat(Math.max(1, Math.round((value / max) * width)));
}

async function main() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  // ── Кто пришёл ──────────────────────────────────────────────────────────
  const [users, usersDay, usersWeek, guests, guestsDay] = await Promise.all([
    prisma.user.count({ where: { isGuest: false } }),
    prisma.user.count({ where: { isGuest: false, createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { isGuest: false, createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { isGuest: true } }),
    prisma.user.count({ where: { isGuest: true, createdAt: { gte: dayAgo } } }),
  ]);

  const withList = await prisma.user.count({
    where: { isGuest: false, watchlist: { some: {} } },
  });
  const guestsWithList = await prisma.user.count({
    where: { isGuest: true, watchlist: { some: {} } },
  });

  console.log("=== ПРИШЛИ ===");
  console.log(`аккаунты: ${users} (+${usersDay} за сутки, +${usersWeek} за неделю)`);
  console.log(`  из них завели список: ${withList} (${pct(withList, users)})`);
  console.log(`гости без регистрации: ${guests} (+${guestsDay} за сутки)`);
  console.log(`  из них завели список: ${guestsWithList} (${pct(guestsWithList, guests)})`);

  // ── Что в списках ───────────────────────────────────────────────────────
  const [entries, entriesDay, withProgress, byStatus] = await Promise.all([
    prisma.watchlistEntry.count(),
    prisma.watchlistEntry.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.watchlistEntry.count({ where: { progress: { gt: 0 } } }),
    prisma.watchlistEntry.groupBy({ by: ["status"], _count: true }),
  ]);

  console.log("\n=== СПИСКИ ===");
  console.log(`записей: ${entries} (+${entriesDay} за сутки), с прогрессом: ${withProgress}`);
  for (const s of byStatus.sort((a, b) => b._count - a._count)) {
    console.log(`  ${s.status.padEnd(10)} ${String(s._count).padStart(5)}`);
  }

  // ── Охват уведомлений: кому вообще есть что слать ───────────────────────
  // Письмо приходит, только если в «смотрю» лежит выходящий тайтл. Без этого
  // человек не получит ни одного уведомления, сколько бы их ни чинили.
  const reachable = await prisma.user.count({
    where: {
      isGuest: false,
      emailNotifications: true,
      email: { not: null },
      watchlist: { some: { status: "watching", title: { status: "releasing" } } },
    },
  });
  const unsubscribed = await prisma.user.count({
    where: { isGuest: false, emailNotifications: false },
  });

  console.log("\n=== ОХВАТ УВЕДОМЛЕНИЙ ===");
  console.log(`могут получить письмо: ${reachable} из ${users} (${pct(reachable, users)})`);
  console.log(`отписались: ${unsubscribed}`);
  if (reachable < users / 2) {
    console.log("  ⚠ у большинства нет онгоингов в «смотрю» — писать им не о чем");
  }

  // ── Возвраты ────────────────────────────────────────────────────────────
  const all = await prisma.user.findMany({
    where: { isGuest: false },
    select: {
      id: true,
      name: true,
      createdAt: true,
      watchlist: { select: { createdAt: true, updatedAt: true } },
    },
  });

  /** Дни после регистрации, когда человек что-то делал со списком. */
  const activeDays = new Map<string, Set<string>>();
  for (const u of all) {
    const reg = day(u.createdAt);
    const days = new Set<string>();
    for (const e of u.watchlist) {
      if (day(e.createdAt) > reg) days.add(day(e.createdAt));
      if (!isArtifact(e.updatedAt) && day(e.updatedAt) > reg) days.add(day(e.updatedAt));
    }
    if (days.size) activeDays.set(u.id, days);
  }

  const eligible = all.filter((u) => u.createdAt < dayAgo);
  const returned = eligible.filter((u) => activeDays.has(u.id));

  console.log("\n=== ВОЗВРАТЫ ===");
  console.log(
    `могли вернуться: ${eligible.length}, вернулись хоть раз: ${returned.length} (${pct(returned.length, eligible.length)})`,
  );

  // Недельные когорты: доля тех, кто вернулся на 7-й день и позже.
  const cohorts = new Map<string, { size: number; d1: number; d7: number }>();
  for (const u of all) {
    const reg = day(u.createdAt);
    const c = cohorts.get(reg) ?? { size: 0, d1: 0, d7: 0 };
    c.size++;
    const days = [...(activeDays.get(u.id) ?? [])];
    const gaps = days.map(
      (d) => (new Date(d).getTime() - new Date(reg).getTime()) / 86_400_000,
    );
    if (gaps.some((g) => g >= 1)) c.d1++;
    if (gaps.some((g) => g >= 7)) c.d7++;
    cohorts.set(reg, c);
  }

  console.log("\n=== КОГОРТЫ (по дню регистрации) ===");
  console.log("  дата         всего   вернулись позже   дожили до недели");
  for (const [date, c] of [...cohorts.entries()].sort()) {
    const weekPassed = (now.getTime() - new Date(date).getTime()) / 86_400_000 >= 7;
    const d7 = weekPassed ? `${c.d7} (${pct(c.d7, c.size)})` : "рано мерить";
    console.log(
      `  ${date}  ${String(c.size).padStart(5)}   ${`${c.d1} (${pct(c.d1, c.size)})`.padEnd(15)}   ${d7}`,
    );
  }

  // ── Живая активность по дням ────────────────────────────────────────────
  const byDay = new Map<string, Set<string>>();
  for (const u of all) {
    for (const e of u.watchlist) {
      const d = day(e.createdAt);
      (byDay.get(d) ?? byDay.set(d, new Set()).get(d)!).add(u.id);
      if (!isArtifact(e.updatedAt)) {
        const up = day(e.updatedAt);
        (byDay.get(up) ?? byDay.set(up, new Set()).get(up)!).add(u.id);
      }
    }
  }

  const recent = [...byDay.entries()].sort().slice(-14);
  const peak = Math.max(...recent.map(([, s]) => s.size), 1);

  console.log("\n=== АКТИВНЫХ ЛЮДЕЙ ПО ДНЯМ (последние 2 недели) ===");
  for (const [date, set] of recent) {
    console.log(`  ${date}  ${String(set.size).padStart(3)}  ${bar(set.size, peak)}`);
  }

  // ── Фидбек и топ тайтлов ────────────────────────────────────────────────
  const feedback = await prisma.feedback.count();
  const feedbackWeek = await prisma.feedback.count({ where: { createdAt: { gte: weekAgo } } });
  console.log(`\n=== ФИДБЕК ===\nвсего: ${feedback}, за неделю: ${feedbackWeek}`);

  const top = await prisma.watchlistEntry.groupBy({
    by: ["titleId"],
    _count: true,
    orderBy: { _count: { titleId: "desc" } },
    take: 8,
  });
  const titles = await prisma.title.findMany({
    where: { id: { in: top.map((t) => t.titleId) } },
    select: { id: true, titleRu: true, title: true },
  });
  const nameById = new Map(titles.map((t) => [t.id, t.titleRu ?? t.title]));

  console.log("\n=== ЧАЩЕ ВСЕГО ДОБАВЛЯЮТ ===");
  for (const t of top) console.log(`  ${String(t._count).padStart(3)}×  ${nameById.get(t.titleId)}`);
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
