-- CreateTable
CREATE TABLE "FranchiseAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FranchiseAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseAlert_userId_titleId_key" ON "FranchiseAlert"("userId", "titleId");

-- AddForeignKey
ALTER TABLE "FranchiseAlert" ADD CONSTRAINT "FranchiseAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseAlert" ADD CONSTRAINT "FranchiseAlert_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

