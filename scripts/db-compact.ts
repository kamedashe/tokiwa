/**
 * Возвращает базе место после большого перегона векторов.
 *
 *   npm run db:compact
 *
 * Каждый полный перегон переписывает все 15 тысяч строк, старые версии
 * остаются мёртвыми. Обычный автовакуум помечает их пригодными для повторного
 * использования, но операционной системе места не отдаёт, а на бесплатном
 * Neon потолок 512 МБ и он близко.
 *
 * ВНИМАНИЕ: VACUUM FULL переписывает таблицу под исключительной блокировкой —
 * на это время каталог сайта недоступен. На 15 тысячах строк это секунды, но
 * запускать посреди наплыва не стоит.
 *
 * Идёт мимо пулера: в transaction mode PgBouncer не даёт держать сессию, а
 * VACUUM FULL к тому же не выполняется внутри транзакции.
 */
import { PrismaClient } from "@prisma/client";

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

async function size(): Promise<{ db: string; title: string }> {
  const [row] = await direct.$queryRaw<{ db: string; title: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) db,
           pg_size_pretty(pg_total_relation_size('"Title"')) title`;
  return row;
}

async function main() {
  if (!process.env.DIRECT_URL) throw new Error("нет DIRECT_URL");

  const before = await size();
  console.log(`до:  база ${before.db}, Title ${before.title}`);

  console.log("VACUUM FULL — таблица заблокирована, это ненадолго...");
  const started = Date.now();
  await direct.$executeRawUnsafe('VACUUM FULL ANALYZE "Title"');

  const after = await size();
  console.log(`после: база ${after.db}, Title ${after.title}`);
  console.log(`заняло ${Math.round((Date.now() - started) / 1000)} с`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => direct.$disconnect());
