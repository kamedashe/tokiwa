-- Русские имена меток.
--
-- Как и в прошлый раз, из вывода migrate diff убран DROP INDEX
-- "Title_embedding_hnsw_idx" — Prisma не знает про hnsw и предлагает его
-- снести в каждой миграции.

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "nameRu" TEXT;
