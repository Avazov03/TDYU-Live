"use client";

import { signOut } from "next-auth/react";

export function SiteSignOut() {
  return (
    <button type="button" className="btn btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
      Chiqish
    </button>
  );
}
