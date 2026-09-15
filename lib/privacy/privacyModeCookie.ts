"use server";

import { cookies } from "next/headers";

const COOKIE_NAME = "privacy_mode";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Read server-side so the very first server-rendered HTML already has
 * amounts masked when privacy mode is on — no flash of real numbers before
 * client JS hydrates (the whole point of this feature is safe screen-sharing). */
export async function getPrivacyModeCookie(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "1";
}

export async function setPrivacyModeCookie(hidden: boolean): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, hidden ? "1" : "0", {
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    path: "/",
  });
}
