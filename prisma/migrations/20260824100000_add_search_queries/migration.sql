-- Живые запросы к смысловому поиску. Ни пользователя, ни адреса, ни куки:
-- нужна только сама формулировка, чтобы видеть, как спрашивают люди, а не
-- как формулирую я в наборе проб.

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "matched" TEXT[],
    "results" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchQuery_createdAt_idx" ON "SearchQuery"("createdAt");

