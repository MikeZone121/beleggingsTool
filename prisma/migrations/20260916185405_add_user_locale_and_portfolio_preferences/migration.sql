-- AlterTable
ALTER TABLE "Portfolio" ADD COLUMN     "benchmarkTicker" TEXT,
ADD COLUMN     "dividendTaxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.30;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en-US';
