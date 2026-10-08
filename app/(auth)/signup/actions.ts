"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { signIn } from "@/lib/auth/config";
import { signupSchema } from "@/lib/validation/auth";
import { isAdminEmail } from "@/lib/auth/adminPolicy";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import { createUserWithDefaultPortfolio, getUserByEmail } from "@/lib/db/users";

function fail(message: string): never {
  redirect(`/signup?error=${encodeURIComponent(message)}`);
}

export async function signup(formData: FormData) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const turnstileToken = formData.get("cf-turnstile-response");
  const turnstileOk = await verifyTurnstileToken(
    typeof turnstileToken === "string" ? turnstileToken : null,
    ip
  );
  if (!turnstileOk) {
    fail("Verification failed — please try again");
  }

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    baseCurrency: formData.get("baseCurrency") || "EUR",
  });

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { name, email, password, baseCurrency } = parsed.data;

  if (await getUserByEmail(email)) {
    fail("An account with this email already exists");
  }

  const passwordHash = await hash(password, 12);
  const role = isAdminEmail(email) ? "ADMIN" : "USER";
  await createUserWithDefaultPortfolio({
    email,
    name,
    passwordHash,
    baseCurrency,
    role,
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  }
}
