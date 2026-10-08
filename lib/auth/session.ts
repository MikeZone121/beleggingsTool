import { redirect } from "next/navigation";
import { auth } from "./config";
import { getUserById } from "@/lib/db/users";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Server Component page guard: redirects to /login when unauthenticated. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user?.id) {
    redirect("/login");
  }
  return user;
}

/** Server Component page guard: redirects non-admins to /dashboard. Reads
 * the role fresh from the DB rather than trusting the JWT-cached one —
 * with `session: { strategy: "jwt" }`, a demoted admin would otherwise
 * keep admin access until their token is reissued. */
export async function requireAdmin() {
  const user = await requireUser();
  const dbUser = await getUserById(user.id!);
  if (dbUser?.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return dbUser;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Route Handler guard: throws instead of redirecting, so the caller can
 * respond with a 401 JSON envelope (see lib/utils/apiResponse.ts). */
export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new UnauthorizedError();
  }
  return user;
}
