import { requireAdmin } from "@/lib/auth/session";
import { getAdminStats, listUsers } from "@/lib/admin/adminService";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminSignupsChart } from "@/components/charts/admin-signups-chart";
import { formatDate } from "@/lib/utils/format";
import { updateUserRole } from "./actions";

export default async function AdminPage() {
  const actingUser = await requireAdmin();
  const [stats, users] = await Promise.all([getAdminStats(), listUsers()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">Account-wide usage, visible only to admins.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Total users" value={stats.totalUsers} />
        <KpiCard label="Admins" value={stats.adminUsers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signups, last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminSignupsChart data={stats.signupsByDay} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((row) => {
                const isSelf = row.id === actingUser.id;
                const nextRole = row.role === "ADMIN" ? "USER" : "ADMIN";

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                    <TableCell>
                      <Badge variant={row.role === "ADMIN" ? "default" : "outline"}>
                        {row.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        <Badge variant="ghost">You</Badge>
                      ) : (
                        <form action={updateUserRole}>
                          <input type="hidden" name="userId" value={row.id} />
                          <input type="hidden" name="role" value={nextRole} />
                          <button
                            type="submit"
                            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {row.role === "ADMIN" ? "Make user" : "Make admin"}
                          </button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
