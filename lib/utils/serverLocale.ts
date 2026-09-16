import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/users";
import { DEFAULT_LOCALE } from "./format";

/**
 * The signed-in user's locale preference, for Server Components that format
 * a number or date themselves. Client components use `useLocale()` from
 * `components/locale-provider.tsx` instead.
 *
 * Wrapped in React's `cache` so several server components on one page share
 * a single query per request rather than each issuing their own.
 */
export const getUserLocale = cache(async (): Promise<string> => {
  const sessionUser = await getCurrentUser();
  if (!sessionUser?.id) return DEFAULT_LOCALE;
  const user = await getUserById(sessionUser.id);
  return user?.locale ?? DEFAULT_LOCALE;
});
