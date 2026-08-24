-- Метки AniList с рангами — источник вектора тона.
--
-- У Shikimori меток 80 на весь каталог и по три на тайтл, поэтому различных
-- наборов выходит 5459 на 15583 тайтла: вектор тона получается грубым
-- классификатором, который внутри категории не различает ничего. У AniList
-- меток сотни и по тринадцать на тайтл — на пробе в 500 тайтлов различных
-- наборов оказалось 492.
--
-- Ранг (0-100 по голосам пользователей) хранится в связи, поэтому связь
-- явная моделью, а не неявной таблицей.

-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "aniTagsSyncedAt" TIMESTAMP(3);
-- CreateTable
CREATE TABLE "AniTag" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AniTag_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "TitleAniTag" (
    "titleId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    CONSTRAINT "TitleAniTag_pkey" PRIMARY KEY ("titleId","tagId")
);
-- CreateIndex
CREATE UNIQUE INDEX "AniTag_name_key" ON "AniTag"("name");
-- CreateIndex
CREATE INDEX "AniTag_category_idx" ON "AniTag"("category");
-- CreateIndex
CREATE INDEX "TitleAniTag_tagId_idx" ON "TitleAniTag"("tagId");
-- AddForeignKey
ALTER TABLE "TitleAniTag" ADD CONSTRAINT "TitleAniTag_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TitleAniTag" ADD CONSTRAINT "TitleAniTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "AniTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
