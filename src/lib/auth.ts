import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { authError, authLog } from "@/lib/auth-log";

export const isGoogleAuthEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

async function syncGoogleUser(
  user: { id?: string; email?: string | null; name?: string | null; image?: string | null; role?: UserRole },
  googleId: string,
): Promise<boolean> {
  const email = user.email?.toLowerCase().trim();
  if (!email) {
    authLog("google_sign_in_rejected", { reason: "no_email" });
    return false;
  }

  try {
    let dbUser = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (dbUser?.isBlocked) {
      authLog("google_sign_in_blocked", { email, userId: dbUser.id });
      return false;
    }

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          fullName: user.name?.trim() || email.split("@")[0],
          email,
          googleId,
          avatarUrl: user.image ?? null,
          role: "student",
        },
      });
      authLog("google_register_success", { userId: dbUser.id, email });
    } else if (!dbUser.googleId) {
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          googleId,
          avatarUrl: dbUser.avatarUrl ?? user.image ?? null,
          fullName: dbUser.fullName || user.name?.trim() || email.split("@")[0],
        },
      });
      authLog("google_account_linked", { userId: dbUser.id, email });
    } else {
      authLog("google_sign_in_success", { userId: dbUser.id, email });
    }

    user.id = dbUser.id;
    user.role = dbUser.role;
    return true;
  } catch (error) {
    authError("google_sign_in_failed", error, { email });
    return false;
  }
}

const providers: NextAuthConfig["providers"] = [];

if (isGoogleAuthEnabled) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: { params: { prompt: "select_account" } },
    }),
  );
}

providers.push(
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Parol", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toString().toLowerCase().trim();
      const password = credentials?.password?.toString();

      if (!email || !password) {
        authLog("credentials_sign_in_failed", { email, reason: "missing_fields" });
        return null;
      }

      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          authLog("credentials_sign_in_failed", { email, reason: "not_found" });
          return null;
        }
        if (user.isBlocked) {
          authLog("credentials_sign_in_failed", { email, reason: "blocked", userId: user.id });
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          authLog("credentials_sign_in_failed", { email, reason: "invalid_password" });
          return null;
        }

        authLog("credentials_sign_in_success", { userId: user.id, email });
        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
        };
      } catch (error) {
        authError("credentials_sign_in_error", error, { email });
        return null;
      }
    },
  }),
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        return syncGoogleUser(user, account.providerAccountId);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
});

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

export async function requireRole(...roles: string[]) {
  const session = await requireAuth();
  if (!session || !roles.includes(session.user.role)) return null;
  return session;
}

export { isAdminRole, isTeacherRole } from "@/lib/roles";
