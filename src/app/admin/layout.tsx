import { redirect } from "next/navigation";
import { auth, isAdminRole } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { BRAND } from "@/lib/brand";
import { countPendingReviews } from "@/lib/admin-courses";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";

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
  const reviewCount = isCourseReviewV1Enabled() ? await countPendingReviews().catch(() => 0) : null;

  return (
    <AdminShell userName={userName} reviewCount={reviewCount}>
      {children}
    </AdminShell>
  );
}

export async function generateMetadata() {
  return { title: `${BRAND.name} — Admin` };
}
