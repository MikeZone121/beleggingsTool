"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth/config";
import { signupSchema } from "@/lib/validation/auth";
import { isEmailAllowedToSignUp } from "@/lib/auth/signupPolicy";
import { createUserWithDefaultPortfolio, getUserByEmail } from "@/lib/db/users";

function fail(message: string): never {
  redirect(`/signup?error=${encodeURIComponent(message)}`);
}

export async function signup(formData: FormData) {
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

  if (!isEmailAllowedToSignUp(email)) {
    fail("This email address isn't authorized to create an account");
  }

  if (await getUserByEmail(email)) {
    fail("An account with this email already exists");
  }

  const passwordHash = await hash(password, 12);
  await createUserWithDefaultPortfolio({ email, name, passwordHash, baseCurrency });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  }
}
