-- DropForeignKey
ALTER TABLE "WatchLink" DROP CONSTRAINT "WatchLink_titleId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- DropTable
DROP TABLE "WatchLink";

