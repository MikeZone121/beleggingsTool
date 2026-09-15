import { requireUser } from "@/lib/auth/session";
import { getPrivacyModeCookie } from "@/lib/privacy/privacyModeCookie";
import { PrivacyModeProvider } from "@/components/privacy-mode-provider";
import { PrivacyModeToggle } from "@/components/privacy-mode-toggle";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const privacyModeHidden = await getPrivacyModeCookie();

  return (
    <PrivacyModeProvider initialHidden={privacyModeHidden}>
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:flex md:flex-col">
          <div className="flex h-14 items-center border-b px-4 text-sm font-semibold">
            Snowcap
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
  );
}
