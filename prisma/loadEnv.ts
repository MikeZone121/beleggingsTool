// Imported for its side effect only, and must be the first import in any
// script (tsx/CLI scripts, unlike Next.js, don't auto-load .env) that
// touches `lib/db/client` — that module reads `process.env.DATABASE_URL` at
// import time, so env vars must be loaded before it is imported.
try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional (e.g. CI, where env vars are already set)
}
