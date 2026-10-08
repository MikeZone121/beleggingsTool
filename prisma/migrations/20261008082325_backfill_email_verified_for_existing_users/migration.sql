-- Grandfather in every account that existed before email verification was
-- introduced: without this, login would start requiring verification for
-- accounts created when there was no verification flow to complete, locking
-- them out of their own app. Only touches rows with no passwordHash-less
-- gap (every real credentials account has one) that are still unverified.
UPDATE "User"
SET "emailVerified" = "createdAt"
WHERE "emailVerified" IS NULL
  AND "passwordHash" IS NOT NULL;
