import { redirect } from "next/navigation";
import { auth } from "./config";

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
