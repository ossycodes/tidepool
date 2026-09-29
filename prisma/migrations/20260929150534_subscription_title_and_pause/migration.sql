-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "customTitle" TEXT,
ADD COLUMN     "paused" BOOLEAN NOT NULL DEFAULT false;
