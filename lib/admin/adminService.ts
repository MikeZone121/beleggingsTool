import { format } from "date-fns";
import { prisma } from "@/lib/db/client";
import type { Role } from "@/generated/prisma/client";

export interface AdminStats {
  totalUsers: number;
  adminUsers: number;
  signupsByDay: { date: string; count: number }[];
}

const SIGNUP_CHART_DAYS = 30;

/** Day-bucketed signup counts over the last `SIGNUP_CHART_DAYS` days,
 * computed in JS from raw timestamps — proportionate at this app's scale
 * (single-digit/low-hundreds users), no need for a SQL date-trunc. */
export async function getAdminStats(): Promise<AdminStats> {
  const [totalUsers, adminUsers, signupDates] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.findMany({ select: { createdAt: true } }),
  ]);

  const counts = new Map<string, number>();
  const today = new Date();
  for (let i = SIGNUP_CHART_DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    counts.set(format(day, "yyyy-MM-dd"), 0);
  }
  for (const { createdAt } of signupDates) {
    const key = format(createdAt, "yyyy-MM-dd");
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    totalUsers,
    adminUsers,
    signupsByDay: Array.from(counts, ([date, count]) => ({ date, count })),
  };
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export class AdminActionError extends Error {}

/** Changes a user's role, refusing to let an admin strip their own role
 * (avoiding an accidental self-lockout) or demote the last remaining
 * admin (which would leave the dashboard with nobody able to reach it). */
export async function setUserRole(
  targetUserId: string,
  role: Role,
  actingUserId: string
): Promise<void> {
  if (targetUserId === actingUserId) {
    throw new AdminActionError("You can't change your own role");
  }

  if (role === "USER") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (target?.role === "ADMIN" && adminCount <= 1) {
      throw new AdminActionError("Can't demote the last remaining admin");
    }
  }

  await prisma.user.update({ where: { id: targetUserId }, data: { role } });
}
