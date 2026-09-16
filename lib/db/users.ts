import { prisma } from "./client";

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

/** Display-only preferences (see Settings). Email is deliberately not
 * editable here: it's the login identity, so changing it needs a
 * verification flow rather than a plain field. */
export async function updateUserProfile(
  userId: string,
  data: { name: string; locale: string }
) {
  return prisma.user.update({
    where: { id: userId },
    data: { name: data.name, locale: data.locale },
  });
}

/**
 * Creates a new user with the starter portfolio/account every subsequent
 * page assumes exists (`getDefaultPortfolio`) — signing up always leaves a
 * user ready to record transactions immediately, never in a half-set-up
 * state. All three rows are created atomically.
 */
export async function createUserWithDefaultPortfolio(data: {
  email: string;
  name: string;
  passwordHash: string;
  baseCurrency: string;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, name: data.name, passwordHash: data.passwordHash },
    });
    const portfolio = await tx.portfolio.create({
      data: {
        userId: user.id,
        name: "Main Portfolio",
        baseCurrency: data.baseCurrency,
        isDefault: true,
      },
    });
    await tx.account.create({
      data: {
        portfolioId: portfolio.id,
        name: "Brokerage Account",
        currency: data.baseCurrency,
      },
    });
    return user;
  });
}
