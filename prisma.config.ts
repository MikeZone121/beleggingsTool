import "./prisma/loadEnv";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations/CLI need the *direct* (unpooled) connection — Prisma
    // Postgres (and similar pooled providers) expose this separately as
    // DIRECT_URL, since `migrate deploy` runs DDL the pooler can't proxy.
    // Falls back to DATABASE_URL for local dev, where there's no pooler and
    // only one connection string exists.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
