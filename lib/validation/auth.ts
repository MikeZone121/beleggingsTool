import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  baseCurrency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter ISO currency code")
    .toUpperCase()
    .default("EUR"),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
