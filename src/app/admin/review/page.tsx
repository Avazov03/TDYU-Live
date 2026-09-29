import { redirect } from "next/navigation";
import { AdminCourseReviewQueue } from "@/components/admin/AdminCourseReviewQueue";
import { getAdminReviewQueue } from "@/lib/admin-courses";
import { isCourseReviewV1Enabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function AdminReviewPage() {
  if (!isCourseReviewV1Enabled()) redirect("/admin/courses");
  const queue = await getAdminReviewQueue();
  const now = new Date();
  const fresh = queue.filter((c) => c.lifecycleStatus === "submitted").length;
  const inReview = queue.filter((c) => c.lifecycleStatus === "in_review").length;
  const toPublish = queue.filter((c) => c.lifecycleStatus === "approved").length;
  const parts = [
    fresh ? `${fresh} ta yangi` : null,
    inReview ? `${inReview} tasi tekshirilmoqda` : null,
    toPublish ? `${toPublish} tasi nashr kutmoqda` : null,
  ].filter(Boolean);

  return (
    <div className="admin-board">
      <header className="lx-mc-head lx-admin-head">
        <div>
          <p className="lx-kicker">Kurslar</p>
          <h1 className="lx-mc-title">Tekshiruv</h1>
          <p className="lx-mc-sub">
            {parts.length ? parts.join(" · ") : "Navbat bo‘sh"} · eng uzoq kutganlar birinchi
          </p>
        </div>
      </header>
      <AdminCourseReviewQueue courses={queue} nowIso={now.toISOString()} />
    </div>
  );
}
