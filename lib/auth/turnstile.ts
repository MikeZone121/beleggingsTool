/**
 * Verifies a Cloudflare Turnstile response token server-side. Fails closed
 * (returns false) when TURNSTILE_SECRET_KEY isn't configured, the token is
 * missing, or the request to Cloudflare errors — signup should never
 * silently skip the anti-spam gate just because it isn't set up yet.
 */
export async function verifyTurnstileToken(
  token: string | null,
  remoteIp: string | null
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
