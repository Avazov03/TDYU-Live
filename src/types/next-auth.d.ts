import type { UserRole } from "@/generated/prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
    impersonatorId?: string;
  }

  interface User {
    role: UserRole;
    impersonatorId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    impersonatorId?: string;
  }
}
