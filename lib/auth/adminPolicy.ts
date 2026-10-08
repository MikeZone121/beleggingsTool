/**
 * Comma-separated emails in ADMIN_EMAILS are auto-promoted to ADMIN at
 * signup time (checked once, at account creation — promoting/demoting
 * afterward happens from the Admin dashboard, not by editing this list).
 * This is a privilege grant, not an access gate, so the safe default when
 * unset is the opposite of the old invite allowlist: nobody is auto-admin,
 * not everybody.
 */
export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;

  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return list.includes(email.trim().toLowerCase());
}
