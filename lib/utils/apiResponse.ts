import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth/session";

/** Consistent `{ data }` / `{ error }` envelope for every API route — never
 * leak a raw error message/stack from an unexpected exception to the client. */
export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, string[]>
) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/** Maps a caught error to a response, without leaking internals for
 * unexpected (non-domain) errors. */
export function apiErrorFromException(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return apiError("UNAUTHORIZED", "Authentication required", 401);
  }
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".") || "_root";
      details[path] = [...(details[path] ?? []), issue.message];
    }
    return apiError("VALIDATION_ERROR", "Invalid input", 400, details);
  }
  if (error instanceof Error) {
    // Domain errors thrown by lib/db and lib/finance (e.g. "Account not
    // found", "Cannot sell N shares...") are safe and useful to surface.
    return apiError("REQUEST_ERROR", error.message, 400);
  }
  console.error("Unhandled API error", error);
  return apiError("INTERNAL_ERROR", "Something went wrong", 500);
}
