-- CreateTable
CREATE TABLE "_TitleRelations" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TitleRelations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TitleRelations_B_index" ON "_TitleRelations"("B");

-- AddForeignKey
ALTER TABLE "_TitleRelations" ADD CONSTRAINT "_TitleRelations_A_fkey" FOREIGN KEY ("A") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TitleRelations" ADD CONSTRAINT "_TitleRelations_B_fkey" FOREIGN KEY ("B") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

