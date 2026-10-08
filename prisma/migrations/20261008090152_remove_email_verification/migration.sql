-- Email verification is being deferred to a later iteration — drop the
-- column and its supporting table rather than leave unused/dead schema.
ALTER TABLE "User" DROP COLUMN "emailVerified";

DROP TABLE "EmailVerificationToken";
