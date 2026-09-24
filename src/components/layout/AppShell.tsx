import { auth } from "@/lib/auth";
import {
  getAnyActiveSubscription,
  resolveStudentShellTariffTier,
} from "@/lib/access";
import { getEnrollmentAccessMode } from "@/lib/feature-flags";
import { getShellData } from "@/lib/shell-data";
import { Sidebar, type NavKey } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type AppShellProps = {
  children: React.ReactNode;
  active?: NavKey;
  mainClassName?: string;
};

export async function AppShell({ children, active, mainClassName }: AppShellProps) {
  const session = await auth();
  const shell = await getShellData(session?.user?.id);
  const mode = getEnrollmentAccessMode();
  const sub =
    session?.user?.id && mode !== "enrollment"
      ? await getAnyActiveSubscription(session.user.id)
      : null;
  const tariffTier = resolveStudentShellTariffTier({
    mode,
    subscriptionTier: sub?.tier ?? null,
  });

  return (
    <div className="shell acet-shell">
      <Sidebar
        active={active}
        userRole={shell.userRole}
        userName={shell.userName}
        tariffTier={tariffTier}
      />
      <div className="acet-pane">
        <Topbar
          loggedIn={shell.loggedIn}
          userName={shell.userName}
          userEmail={shell.userEmail}
          userRole={shell.userRole}
          unreadCount={shell.unreadCount}
          impersonating={Boolean(session?.impersonatorId)}
        />
        <main className={mainClassName ? `main ${mainClassName}` : "main"}>
          <div className="main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}

export async function AppShellNarrow({ children, active }: AppShellProps) {
  return (
    <AppShell active={active} mainClassName="narrow">
      {children}
    </AppShell>
  );
}
