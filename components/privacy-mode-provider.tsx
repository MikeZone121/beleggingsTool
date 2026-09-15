"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { setPrivacyModeCookie } from "@/lib/privacy/privacyModeCookie";

interface PrivacyModeContextValue {
  hidden: boolean;
  toggle: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextValue>({
  hidden: false,
  toggle: () => {},
});

/**
 * `initialHidden` comes from a cookie read server-side (see
 * `privacyModeCookie.ts`) so the very first render — server AND client — is
 * already correctly masked. Toggling updates local state immediately (for
 * instant UI feedback) and persists via a Server Action so a reload/re-login
 * still starts masked.
 */
export function PrivacyModeProvider({
  initialHidden,
  children,
}: {
  initialHidden: boolean;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(initialHidden);

  function toggle() {
    setHidden((prev) => {
      const next = !prev;
      void setPrivacyModeCookie(next);
      return next;
    });
  }

  return (
    <PrivacyModeContext.Provider value={{ hidden, toggle }}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

export function usePrivacyMode() {
  return useContext(PrivacyModeContext);
}
