-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestFrequency" "DigestFrequency" NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN     "digestMinPosts" INTEGER NOT NULL DEFAULT 1;

