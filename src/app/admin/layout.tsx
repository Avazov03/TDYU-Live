import { redirect } from "next/navigation";
import { auth, isAdminRole } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }
  if (!isAdminRole(session.user.role)) {
    redirect("/");
  }

  const userName = session.user.name ?? "Admin";

  return <AdminShell userName={userName}>{children}</AdminShell>;
}

export async function generateMetadata() {
  return { title: "TDYU Live — Admin" };
}
