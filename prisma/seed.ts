import "./loadEnv";
import { hash } from "bcryptjs";
import { prisma } from "../lib/db/client";

/**
 * Seeds the single personal user (from env), a default EUR portfolio, one
 * brokerage account, a handful of securities, and enough sample
 * transactions/FX rates to see every part of the app populated. Safe to
 * re-run: uses upserts / existence checks throughout.
 */
function monthsAgo(months: number): Date {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
}

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME ?? "Portfolio Owner";

  if (!email || !password) {
    throw new Error(
      "SEED_USER_EMAIL and SEED_USER_PASSWORD must be set in .env before seeding"
    );
  }

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { name, passwordHash },
  });

  const portfolio = await prisma.portfolio.upsert({
    where: { id: `${user.id}-default` },
    create: {
      id: `${user.id}-default`,
      userId: user.id,
      name: "Main Portfolio",
      baseCurrency: "EUR",
      isDefault: true,
    },
    update: {},
  });

  const account = await prisma.account.upsert({
    where: { id: `${portfolio.id}-main` },
    create: {
      id: `${portfolio.id}-main`,
      portfolioId: portfolio.id,
      name: "Brokerage Account",
      brokerName: "Example Broker",
      currency: "EUR",
    },
    update: {},
  });

  const asml = await prisma.security.upsert({
    where: { ticker_exchange: { ticker: "ASML", exchange: "Euronext" } },
    create: {
      ticker: "ASML",
      name: "ASML Holding N.V.",
      isin: "NL0010273215",
      assetType: "STOCK",
      exchange: "Euronext",
      currency: "EUR",
      country: "NL",
      sector: "Technology",
      currentPrice: "720.00",
      priceUpdatedAt: new Date(),
    },
    update: {},
  });

  const aapl = await prisma.security.upsert({
    where: { ticker_exchange: { ticker: "AAPL", exchange: "NASDAQ" } },
    create: {
      ticker: "AAPL",
      name: "Apple Inc.",
      isin: "US0378331005",
      assetType: "STOCK",
      exchange: "NASDAQ",
      currency: "USD",
      country: "US",
      sector: "Technology",
      currentPrice: "225.00",
      priceUpdatedAt: new Date(),
    },
    update: {},
  });

  const vwce = await prisma.security.upsert({
    where: { ticker_exchange: { ticker: "VWCE", exchange: "Euronext" } },
    create: {
      ticker: "VWCE",
      name: "Vanguard FTSE All-World UCITS ETF",
      isin: "IE00BK5BQT80",
      assetType: "ETF",
      exchange: "Euronext",
      currency: "EUR",
      country: "IE",
      sector: null,
      currentPrice: "115.00",
      priceUpdatedAt: new Date(),
    },
    update: {},
  });

  await prisma.exchangeRate.upsert({
    where: {
      baseCurrency_quoteCurrency_date: {
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        date: new Date("2024-01-01"),
      },
    },
    create: {
      baseCurrency: "USD",
      quoteCurrency: "EUR",
      date: new Date("2024-01-01"),
      rate: "0.91",
      source: "manual",
    },
    update: {},
  });
  await prisma.exchangeRate.upsert({
    where: {
      baseCurrency_quoteCurrency_date: {
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        date: new Date(),
      },
    },
    create: {
      baseCurrency: "USD",
      quoteCurrency: "EUR",
      date: new Date(),
      rate: "0.92",
      source: "manual",
    },
    update: {},
  });

  const existingTransactions = await prisma.transaction.count({ where: { accountId: account.id } });
  if (existingTransactions === 0) {
    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          date: new Date("2023-01-05"),
          grossAmount: "20000",
          netAmount: "20000",
          currency: "EUR",
        },
        {
          accountId: account.id,
          securityId: asml.id,
          type: "BUY",
          date: new Date("2023-02-01"),
          quantity: "10",
          price: "580.00",
          grossAmount: "5800",
          fees: "10",
          netAmount: "5810",
          currency: "EUR",
        },
        {
          accountId: account.id,
          securityId: vwce.id,
          type: "BUY",
          date: new Date("2023-03-01"),
          quantity: "50",
          price: "95.00",
          grossAmount: "4750",
          fees: "5",
          netAmount: "4755",
          currency: "EUR",
        },
        {
          accountId: account.id,
          securityId: aapl.id,
          type: "BUY",
          date: new Date("2023-04-15"),
          quantity: "8",
          price: "165.00",
          grossAmount: "1320",
          fees: "3",
          netAmount: "1323",
          currency: "USD",
          exchangeRate: "0.91",
        },
        {
          accountId: account.id,
          securityId: asml.id,
          type: "SELL",
          date: new Date("2023-11-01"),
          quantity: "3",
          price: "650.00",
          grossAmount: "1950",
          fees: "5",
          netAmount: "1945",
          currency: "EUR",
        },
        {
          accountId: account.id,
          securityId: asml.id,
          type: "DIVIDEND",
          date: new Date("2023-06-01"),
          grossAmount: "24.50",
          taxes: "3.68",
          netAmount: "20.82",
          currency: "EUR",
        },
        {
          accountId: account.id,
          securityId: vwce.id,
          type: "DIVIDEND",
          date: new Date("2024-01-15"),
          grossAmount: "45.00",
          taxes: "6.75",
          netAmount: "38.25",
          currency: "EUR",
        },
        {
          accountId: account.id,
          securityId: asml.id,
          type: "DIVIDEND",
          date: monthsAgo(3),
          grossAmount: "28.00",
          taxes: "4.20",
          netAmount: "23.80",
          currency: "EUR",
        },
        {
          accountId: account.id,
          securityId: vwce.id,
          type: "DIVIDEND",
          date: monthsAgo(9),
          grossAmount: "50.00",
          taxes: "7.50",
          netAmount: "42.50",
          currency: "EUR",
        },
      ],
    });
  }

  console.log(`Seeded user ${user.email} with portfolio "${portfolio.name}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
