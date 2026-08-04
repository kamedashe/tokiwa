/**
 * Отметить человека сторонником проекта.
 *
 *   npm run supporter -- <email> [публичное имя]
 *   npm run supporter -- <email> --off      снять отметку
 *   npm run supporter                        показать список
 *
 * Публичного API подписок у Boosty нет, поэтому список сверяется вручную:
 * открываете кабинет Boosty, берёте почту поддержавшего и запускаете это.
 * Без имени человек получит значок, но в благодарностях назван не будет —
 * так безопаснее: публиковать имя без спроса нельзя.
 */
import { prisma } from "../src/lib/prisma";

async function list() {
  const supporters = await prisma.user.findMany({
    where: { isSupporter: true },
    select: { email: true, name: true, supporterName: true },
    orderBy: { createdAt: "asc" },
  });

  if (supporters.length === 0) {
    console.log("Сторонников пока нет.");
    return;
  }

  console.log(`Сторонников: ${supporters.length}\n`);
  for (const s of supporters) {
    const shown = s.supporterName ? `в благодарностях как «${s.supporterName}»` : "без имени";
    console.log(`  ♥ ${s.name ?? "—"} <${s.email}> — ${shown}`);
  }
}

async function main() {
  const [email, ...rest] = process.argv.slice(2);
  if (!email) return list();

  const user = await prisma.user.findFirst({ where: { email }, select: { id: true, name: true } });
  if (!user) {
    console.log(`Пользователь с адресом ${email} не найден.`);
    return;
  }

  if (rest[0] === "--off") {
    await prisma.user.update({
      where: { id: user.id },
      data: { isSupporter: false, supporterName: null },
    });
    console.log(`Отметка снята: ${user.name ?? email}`);
    return;
  }

  const publicName = rest.join(" ").trim() || null;
  await prisma.user.update({
    where: { id: user.id },
    data: { isSupporter: true, supporterName: publicName },
  });

  console.log(`♥ ${user.name ?? email} — сторонник проекта`);
  console.log(
    publicName
      ? `   в благодарностях: «${publicName}»`
      : "   имя в благодарностях не показываем (передайте вторым аргументом, если разрешил)",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
