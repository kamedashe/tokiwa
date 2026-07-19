import { prisma } from "../src/lib/prisma";
import { syncCatalog, markHomepagePicks } from "../src/lib/sync";

async function main() {
  console.log("Тяну метаданные из Jikan…");
  const count = await syncCatalog({ pages: 2 });
  console.log(`Сохранено/обновлено тайтлов: ${count}`);

  await markHomepagePicks();

  const withDuration = await prisma.title.count({ where: { durationMin: { not: null } } });
  console.log(`Длительность известна у ${withDuration} тайтлов`);

  const total = await prisma.title.count();
  console.log(`Готово. Всего в каталоге: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
