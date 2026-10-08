"use client";

import Script from "next/script";

/** Implicit-render Cloudflare Turnstile widget: once the script loads, it
 * injects a hidden `cf-turnstile-response` input into the surrounding
 * `<form>` on its own, so the token just rides along with the normal
 * FormData — no client state or submit handler needed here. */
export function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="auto" />
    </>
  );
}
