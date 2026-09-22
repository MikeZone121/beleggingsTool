-- AlterTable
ALTER TABLE "Portfolio" ADD COLUMN     "capitalGainsExemption" DECIMAL(18,4) NOT NULL DEFAULT 10000,
ADD COLUMN     "capitalGainsTaxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.10;
