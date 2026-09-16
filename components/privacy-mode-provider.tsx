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
    // The Server Action call here touches Next.js's router internals to
    // schedule a refresh once it resolves — doing that from inside a
    // useState updater (as this used to) counts as a side effect during
    // React's state-resolution phase, which is what produced "Cannot
    // update a component (Router) while rendering a different component
    // (PrivacyModeProvider)". Keeping it in the plain event-handler body
    // instead is the safe place for it.
    const next = !hidden;
    setHidden(next);
    void setPrivacyModeCookie(next);
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
