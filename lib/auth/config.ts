import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db/client";
import type { Role } from "@/generated/prisma/client";

/**
 * Credentials auth backed by real `User` rows — registration is open
 * (see app/(auth)/signup/actions.ts), gated by a Turnstile anti-spam check
 * rather than an invite allowlist. Every DB query elsewhere in the app is
 * scoped by `userId`, so this supports any number of users without
 * further changes.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Required behind a reverse proxy (Vercel, etc.) so Auth.js trusts the
  // forwarded host/proto headers instead of rejecting the request.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : null;
        const password =
          typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      if (session.user && token.role) {
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
