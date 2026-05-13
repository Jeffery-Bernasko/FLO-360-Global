import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type UserRole } from "@/db/schema";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const EIGHT_HOURS_IN_SECONDS = 60 * 60 * 8;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: process.env.NODE_ENV === "development",
  session: {
    strategy: "jwt",
    maxAge: EIGHT_HOURS_IN_SECONDS,
    updateAge: 60 * 30,
  },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        if (!user.id) {
          throw new Error("Invalid user id");
        }
        const role = (user as { role?: UserRole }).role;
        if (role !== "worker" && role !== "manager") {
          throw new Error("Invalid user role");
        }
        token.id = user.id;
        token.role = role;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.id) {
        throw new Error("Invalid session token");
      }
      if (token.role !== "worker" && token.role !== "manager") {
        throw new Error("Invalid session role");
      }
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});
