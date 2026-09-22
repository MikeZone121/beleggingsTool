import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/users";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { listAccounts } from "@/lib/db/accounts";
import { DEFAULT_LOCALE } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { PortfolioSettingsForm } from "@/components/settings/portfolio-settings-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";

const ACCOUNTING_METHOD_LABEL: Record<string, string> = {
  AVERAGE_COST: "Average cost",
};

/** One section per card, each with a subtitle saying what it affects — the
 * page used to be three read-only summaries and a promise that editing
 * would come later, so the ordering here is "who you are, what you're
 * tracking, how it looks, how it's protected, your data". */
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function SettingsPage() {
  const sessionUser = await requireUser();
  const [user, portfolio] = await Promise.all([
    getUserById(sessionUser.id!),
    getDefaultPortfolio(sessionUser.id!),
  ]);

  if (!user || !portfolio) {
    return (
      <EmptyState
        title="No portfolio yet"
        description="Something went wrong setting up your account — no default portfolio was found."
      />
    );
  }

  const accounts = await listAccounts(user.id, portfolio.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your profile, how this portfolio is tracked and reported, and your data.
        </p>
      </div>

      <SettingsSection
        title="Profile"
        description="Your name and how numbers and dates are displayed throughout the app."
      >
        <ProfileForm
          name={user.name ?? ""}
          email={user.email}
          locale={user.locale ?? DEFAULT_LOCALE}
          baseCurrency={portfolio.baseCurrency}
        />
      </SettingsSection>

      <SettingsSection
        title="Portfolio"
        description="What currency you report in, what you measure yourself against, and how dividends and realized gains are taxed."
      >
        <PortfolioSettingsForm
          name={portfolio.name}
          baseCurrency={portfolio.baseCurrency}
          benchmarkTicker={portfolio.benchmarkTicker}
          dividendTaxRate={portfolio.dividendTaxRate.toString()}
          capitalGainsTaxRate={portfolio.capitalGainsTaxRate.toString()}
          capitalGainsExemption={portfolio.capitalGainsExemption.toString()}
        />
        <div className="mt-5 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Cost basis method</div>
            <div>
              {ACCOUNTING_METHOD_LABEL[portfolio.accountingMethod] ?? portfolio.accountingMethod}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Fixed once transactions exist — switching it would restate every realized gain
              you&apos;ve already reported.
            </p>
          </div>
          <div>
            <div className="text-muted-foreground">Accounts</div>
            <div>
              {accounts.length === 0
                ? "—"
                : accounts.map((account) => `${account.name} (${account.currency})`).join(", ")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Where transactions are booked. Managed from the Transactions page.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Appearance"
        description="Theme and whether amounts are masked on screen. Stored on this device."
      >
        <AppearanceSettings />
      </SettingsSection>

      <SettingsSection title="Security" description="Change the password you sign in with.">
        <ChangePasswordForm />
      </SettingsSection>

      <SettingsSection
        title="Your data"
        description="Everything you've entered, in a plain-text file you keep."
      >
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-fit"
            render={<a href="/api/settings/export" download />}
            nativeButton={false}
          >
            <Download className="size-4" />
            Export as JSON
          </Button>
          <p className="text-xs text-muted-foreground">
            Includes your portfolio settings, accounts, transactions, watchlist and allocation
            targets. Prices, exchange rates and synced dividend history are left out — they are
            re-fetched from the market data provider, so they&apos;re not yours to lose. Amounts
            are written as text, not numbers, so no value gets rounded on the way out.
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}
