import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./client";
import type { SecurityInput } from "@/lib/validation/security";

export async function listSecurities() {
  return prisma.security.findMany({ orderBy: { ticker: "asc" } });
}

export async function getSecurityById(securityId: string) {
  return prisma.security.findUnique({ where: { id: securityId } });
}

export async function getSecuritiesByIds(securityIds: string[]) {
  if (securityIds.length === 0) return [];
  return prisma.security.findMany({ where: { id: { in: securityIds } } });
}

export async function createSecurity(data: SecurityInput) {
  try {
    return await prisma.security.create({
      data: {
        ticker: data.ticker,
        name: data.name,
        isin: data.isin ?? null,
        assetType: data.assetType,
        exchange: data.exchange ?? null,
        currency: data.currency,
        country: data.country ?? null,
        sector: data.sector ?? null,
        currentPrice: data.currentPrice ?? null,
        priceUpdatedAt: data.currentPrice ? new Date() : null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(
        `A security with ticker "${data.ticker}" on exchange "${data.exchange ?? "—"}" already exists`
      );
    }
    throw error;
  }
}

export async function updateSecurityPrice(securityId: string, price: string) {
  return prisma.security.update({
    where: { id: securityId },
    data: { currentPrice: price, priceUpdatedAt: new Date() },
  });
}
