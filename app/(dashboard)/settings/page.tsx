import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Name</div>
            <div>{user.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Email</div>
            <div>{user.email}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Name</div>
            <div>{portfolio?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Base currency</div>
            <div>{portfolio?.baseCurrency ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Accounting method</div>
            <div>{portfolio?.accountingMethod ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Editing these preferences, plus display and number-formatting options, will land in a
        later phase of this app.
      </p>
    </div>
  );
}
