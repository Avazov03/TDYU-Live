import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createRestoreTicket } from "@/lib/impersonate";

export async function POST() {
  const session = await auth();
  const adminId = session?.impersonatorId;
  if (!adminId) {
    return NextResponse.json({ error: "Hozir o'qituvchi sifatida emassiz" }, { status: 400 });
  }
  return NextResponse.json({ ticket: createRestoreTicket(adminId) });
}
