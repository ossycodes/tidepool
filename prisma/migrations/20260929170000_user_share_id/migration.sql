-- AlterTable
ALTER TABLE "User" ADD COLUMN     "shareId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_shareId_key" ON "User"("shareId");
