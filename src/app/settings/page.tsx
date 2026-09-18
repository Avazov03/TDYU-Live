import { redirect } from "next/navigation";
import { AppShellNarrow } from "@/components/layout/AppShell";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      language: true,
      theme: true,
      role: true,
      telegramChatId: true,
    },
  });
  if (!user) redirect("/login");

  return (
    <AppShellNarrow>
      <div className="lx-board">
        <p className="lx-kicker">Kabinet</p>
        <h2 style={{ marginBottom: 16 }}>Sozlamalar</h2>
        <SettingsForm
          initial={{
            userId: user.id,
            fullName: user.fullName,
            email: user.email,
            language: user.language,
            theme: user.theme,
            role: user.role,
            telegramChatId: user.telegramChatId,
          }}
        />
      </div>
    </AppShellNarrow>
  );
}
