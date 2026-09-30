-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "excludeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "includeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mutedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

