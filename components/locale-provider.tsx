"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE } from "@/lib/utils/format";

const LocaleContext = createContext<string>(DEFAULT_LOCALE);

/**
 * Supplies the signed-in user's `locale` preference (see Settings) to every
 * client component that formats a number or date. Read from the database in
 * the dashboard layout and passed down, rather than kept in the session
 * token, so changing the setting takes effect on the next render instead of
 * the next sign-in.
 *
 * Deliberately a plain string in context with no state: the value only
 * changes when the server re-renders with a new one, so there's nothing to
 * keep in sync — unlike `PrivacyModeProvider`, which toggles client-side.
 */
export function LocaleProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** The user's BCP 47 locale tag, for the `locale` option on the formatters
 * in `lib/utils/format.ts`. */
export function useLocale(): string {
  return useContext(LocaleContext);
}
