import { auth } from "@/lib/auth";
import { getAnyActiveSubscription } from "@/lib/access";
import { getShellData } from "@/lib/shell-data";
import { Sidebar, type NavKey } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type AppShellProps = {
  children: React.ReactNode;
  active?: NavKey;
  mainClassName?: string;
};

export async function AppShell({ children, active = "home", mainClassName }: AppShellProps) {
  const session = await auth();
  const shell = await getShellData(session?.user?.id);
  const sub = session?.user?.id ? await getAnyActiveSubscription(session.user.id) : null;

  return (
    <>
      <Topbar
        loggedIn={shell.loggedIn}
        userName={shell.userName}
        userEmail={shell.userEmail}
        userRole={shell.userRole}
        unreadCount={shell.unreadCount}
        impersonating={Boolean(session?.impersonatorId)}
      />
      <div className="shell">
        <Sidebar active={active} userRole={shell.userRole} tariffTier={sub?.tier ?? null} />
        <main className={mainClassName ? `main ${mainClassName}` : "main"}>
          <div className="main-inner">{children}</div>
        </main>
      </div>
    </>
  );
}

export async function AppShellNarrow({ children, active = "catalog" }: AppShellProps) {
  return (
    <AppShell active={active} mainClassName="narrow">
      {children}
    </AppShell>
  );
}
