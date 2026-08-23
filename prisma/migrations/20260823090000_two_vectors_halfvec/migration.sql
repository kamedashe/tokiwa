-- Два вектора на тайтл, и оба вдвое компактнее.
--
-- ВНИМАНИЕ: prisma migrate diff сгенерировал отсюда только ADD COLUMN
-- "embeddingTone". Смену типа "embedding" с vector(1024) на halfvec(512) он
-- НЕ ВИДИТ: колонка помечена Unsupported, и типы таких колонок Prisma не
-- сравнивает вообще. Любая правка типа у Unsupported-поля пишется руками,
-- иначе она молча не доедет до прода.
--
-- DROP INDEX здесь, в отличие от прошлых миграций, намеренный: смешанный
-- порядок «столько-то тона плюс столько-то сюжета» hnsw использовать не
-- может — он умеет одну метрику, а не сумму двух.

DROP INDEX IF EXISTS "Title_embedding_hnsw_idx";

-- Меняем тип через DROP + ADD, а не ALTER TYPE: ALTER переписал бы таблицу,
-- а места нет — база и так упёрлась в 460 МБ из 512. Вектора всё равно
-- пересчитываются заново, терять нечего.
ALTER TABLE "Title" DROP COLUMN "embedding";

ALTER TABLE "Title" ADD COLUMN     "embedding" halfvec(512),
ADD COLUMN     "embeddingTone" halfvec(512);

-- Хеши остались от прежних векторов; без сброса прогон решит, что часть
-- каталога уже посчитана.
UPDATE "Title" SET "embeddingHash" = NULL, "embeddedAt" = NULL;
