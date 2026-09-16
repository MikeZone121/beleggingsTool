import { requireUser } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/users";
import { getPrivacyModeCookie } from "@/lib/privacy/privacyModeCookie";
import { DEFAULT_LOCALE } from "@/lib/utils/format";
import { LocaleProvider } from "@/components/locale-provider";
import { PrivacyModeProvider } from "@/components/privacy-mode-provider";
import { PrivacyModeToggle } from "@/components/privacy-mode-toggle";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // The session token carries id/email/name but not preferences, so the
  // locale is read fresh here — a change in Settings then applies on the
  // next render rather than only after signing in again.
  const [privacyModeHidden, dbUser] = await Promise.all([
    getPrivacyModeCookie(),
    getUserById(user.id!),
  ]);

  return (
    <LocaleProvider locale={dbUser?.locale ?? DEFAULT_LOCALE}>
      <PrivacyModeProvider initialHidden={privacyModeHidden}>
        <div className="flex min-h-screen">
          <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:flex md:flex-col">
            <div className="flex h-14 items-center border-b px-4 text-sm font-semibold">
              Canopy
            </div>
            <SidebarNav />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center justify-between border-b px-4">
              <div className="flex min-w-0 items-center gap-2">
                <MobileNav />
                <span className="truncate text-sm text-muted-foreground">{user.email}</span>
              </div>
              <div className="flex items-center gap-1">
                <PrivacyModeToggle />
                <ThemeToggle />
                <SignOutButton />
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
          </div>
        </div>
      </PrivacyModeProvider>
    </LocaleProvider>
  );
}
