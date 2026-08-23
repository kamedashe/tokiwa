-- Смысловой поиск: вектор описания на каждый тайтл.

-- pgvector на Neon доступен, но по умолчанию не включён. Без этой строки
-- ALTER TABLE ниже падает на неизвестном типе vector.
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "embeddedAt" TIMESTAMP(3),
ADD COLUMN     "embedding" vector(1024),
ADD COLUMN     "embeddingHash" TEXT;

-- Индекс приблизительного ближайшего соседа. Полный перебор 15k векторов
-- база тоже осилила бы, но он линеен по каталогу, а каталог растёт синком.
-- Операторный класс задаёт метрику: косинус, то есть оператор <=>.
CREATE INDEX "Title_embedding_hnsw_idx" ON "Title" USING hnsw ("embedding" vector_cosine_ops);
