/**
 * Signup is invite-only: only emails listed in `ALLOWED_SIGNUP_EMAILS`
 * (comma-separated) may register. This is deliberately a closed allowlist,
 * not an open-registration app — if the env var is unset, nobody can sign
 * up (a safe default) rather than silently allowing everyone.
 */
export function isEmailAllowedToSignUp(email: string): boolean {
  const raw = process.env.ALLOWED_SIGNUP_EMAILS;
  if (!raw) return false;

  const allowlist = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(email.trim().toLowerCase());
}
