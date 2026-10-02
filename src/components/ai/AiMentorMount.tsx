"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { aiHiddenOnPath, type AiRole } from "@/lib/ai/policy";

const AiMentor = dynamic(() => import("./AiMentor").then((m) => m.AiMentor), { ssr: false });

export type AiStatus = { enabled: true; role: AiRole; firstName: string | null };

/** Loads the assistant bundle only when the server says it is enabled for this viewer. */
export function AiMentorMount() {
  const pathname = usePathname() ?? "/";
  const { status: sessionStatus, data } = useSession();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const userId = data?.user?.id ?? null;

  useEffect(() => {
    if (sessionStatus === "loading") return;
    let alive = true;
    fetch("/api/ai/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive) setStatus(j?.enabled ? (j as AiStatus) : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sessionStatus, userId]);

  if (!status || aiHiddenOnPath(pathname)) return null;
  return <AiMentor key={userId ?? "guest"} status={status} pathname={pathname} />;
}
