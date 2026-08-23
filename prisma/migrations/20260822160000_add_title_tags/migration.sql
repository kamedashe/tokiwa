-- Тематические метки Shikimori (theme/demographic), которых не было в Genre.
--
-- ВНИМАНИЕ: prisma migrate diff в этот файл добавил DROP INDEX
-- "Title_embedding_hnsw_idx" — и он удалён отсюда вручную. Prisma не умеет
-- описывать hnsw в схеме, поэтому считает индекс лишним и будет предлагать
-- снести его в каждой следующей миграции. Всегда вычищать эту строку.

-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "tagsSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TagToTitle" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TagToTitle_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Tag_kind_idx" ON "Tag"("kind");

-- CreateIndex
CREATE INDEX "_TagToTitle_B_index" ON "_TagToTitle"("B");

-- AddForeignKey
ALTER TABLE "_TagToTitle" ADD CONSTRAINT "_TagToTitle_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTitle" ADD CONSTRAINT "_TagToTitle_B_fkey" FOREIGN KEY ("B") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
