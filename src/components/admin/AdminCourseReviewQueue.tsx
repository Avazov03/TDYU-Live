"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminReviewCourse } from "@/lib/admin-courses";
import { lifecycleLabel } from "@/lib/course-review-policy";
import { formatSom } from "@/lib/tariffs";

type Action = "start_review" | "request_changes" | "reject" | "approve" | "publish";

const DECISION_LABEL: Record<string, string> = {
  submitted: "Yuborildi",
  changes_requested: "O‘zgartirish so‘raldi",
  rejected: "Rad etildi",
  approve_publish: "Tasdiqlandi",
};

function tone(status: AdminReviewCourse["lifecycleStatus"]) {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "pending";
}

export function AdminCourseReviewQueue({ courses }: { courses: AdminReviewCourse[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(
    courses.find((c) => c.lifecycleStatus === "submitted" || c.lifecycleStatus === "in_review")?.id ??
      null,
  );
  const [reason, setReason] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pending = courses.filter(
    (c) => c.lifecycleStatus === "submitted" || c.lifecycleStatus === "in_review",
  ).length;

  const act = async (course: AdminReviewCourse, action: Action) => {
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(`/api/admin/courses/${course.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...(action === "request_changes" || action === "reject" ? { reason } : {}),
        ...(action === "approve"
          ? {
              listPrice: Number(price.replace(/\s/g, "")),
              capacity: capacity.trim() ? Number(capacity.replace(/\s/g, "")) : null,
            }
          : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Amal bajarilmadi");
      return;
    }
    setNotice(`«${course.titleUz}» — ${lifecycleLabel(data.lifecycleStatus)}`);
    setReason("");
    setPrice("");
    setCapacity("");
    router.refresh();
  };

  return (
    <section className="admin-panel" data-testid="admin-review-queue">
      <div className="admin-panel-head">
        <h3>Tekshiruv</h3>
        <span className={`badge ${pending ? "pending" : "success"}`}>
          {pending ? `${pending} ta kutmoqda` : "Navbat bo‘sh"}
        </span>
      </div>
      {notice ? <p className="small" style={{ color: "var(--success)" }}>{notice}</p> : null}
      {courses.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          O‘qituvchi kursni tekshiruvga yuborganda shu yerda paydo bo‘ladi.
        </p>
      ) : (
        <div className="lx-stack">
          {courses.map((course) => {
            const open = openId === course.id;
            const reviewable =
              course.lifecycleStatus === "submitted" || course.lifecycleStatus === "in_review";
            return (
              <article
                key={course.id}
                className={`admin-course-card${open ? " is-open" : ""}`}
                data-testid="review-course"
                data-course-id={course.id}
              >
                <button
                  type="button"
                  className="admin-course-main"
                  aria-expanded={open}
                  onClick={() => {
                    setOpenId(open ? null : course.id);
                    setError("");
                    setReason("");
                    setPrice(course.listPrice ? String(course.listPrice) : "");
                    setCapacity(course.capacity ? String(course.capacity) : "");
                  }}
                >
                  <div className="admin-course-title">
                    <h4>{course.titleUz}</h4>
                    <p className="small muted" style={{ margin: 0 }}>
                      {course.teacherName} · {course.lessons.length} dars
                      {course.listPrice ? ` · ${formatSom(course.listPrice)}` : ""}
                    </p>
                  </div>
                  <span className={`badge ${tone(course.lifecycleStatus)}`}>
                    {lifecycleLabel(course.lifecycleStatus)}
                  </span>
                </button>
                {open ? (
                  <div className="admin-course-detail">
                    <p style={{ whiteSpace: "pre-wrap", margin: "0 0 12px" }}>{course.descriptionUz}</p>
                    {course.topicUz ? (
                      <p className="small muted" style={{ margin: "0 0 12px" }}>Mavzu: {course.topicUz}</p>
                    ) : null}
                    <div className="small muted" style={{ marginBottom: 4 }}>Dars rejasi</div>
                    <ul className="small" style={{ margin: "0 0 12px", paddingLeft: 18 }}>
                      {course.lessons.map((l) => (
                        <li key={l.id}>
                          {l.titleUz} · {l.whenLabel}
                        </li>
                      ))}
                    </ul>

                    {course.events.length > 0 ? (
                      <>
                        <div className="small muted" style={{ marginBottom: 4 }}>Tarix</div>
                        <ul className="small" style={{ margin: "0 0 12px", paddingLeft: 18 }}>
                          {course.events.map((e) => (
                            <li key={e.id}>
                              {e.whenLabel} · {DECISION_LABEL[e.decision] ?? e.decision} ·{" "}
                              {e.actorName}
                              {e.priceSet ? ` · ${formatSom(e.priceSet)}` : ""}
                              {e.reason ? ` — ${e.reason}` : ""}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    {reviewable ? (
                      <div className="soft-form">
                        <div className="field">
                          <label htmlFor={`reason-${course.id}`}>Sabab (o‘zgartirish yoki rad etish uchun)</label>
                          <textarea
                            id={`reason-${course.id}`}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="O‘qituvchiga nima tuzatish kerakligini yozing"
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`price-${course.id}`}>Narx (so‘m) — tasdiqlash uchun</label>
                          <input
                            id={`price-${course.id}`}
                            inputMode="numeric"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder={String(course.priceT1)}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`capacity-${course.id}`}>Joylar soni — bo‘sh qolsa cheklanmagan</label>
                          <input
                            id={`capacity-${course.id}`}
                            inputMode="numeric"
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value)}
                            placeholder="Cheklanmagan"
                          />
                        </div>
                        <div className="staff-detail-actions">
                          {course.lifecycleStatus === "submitted" ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busy}
                              onClick={() => void act(course, "start_review")}
                            >
                              Tekshirishni boshlash
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={busy}
                            onClick={() => void act(course, "approve")}
                          >
                            Tasdiqlash
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() => void act(course, "request_changes")}
                          >
                            O‘zgartirish so‘rash
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={busy}
                            onClick={() => void act(course, "reject")}
                          >
                            Rad etish
                          </button>
                        </div>
                      </div>
                    ) : course.lifecycleStatus === "approved" ? (
                      <div className="staff-detail-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={busy}
                          onClick={() => void act(course, "publish")}
                        >
                          Nashr qilish
                        </button>
                      </div>
                    ) : (
                      <p className="small muted" style={{ margin: 0 }}>
                        {course.lifecycleStatus === "changes_requested"
                          ? "O‘qituvchi tuzatib qayta yuborishini kutmoqda."
                          : "Rad etilgan — o‘qituvchi yangi kurs yaratishi kerak."}
                      </p>
                    )}
                    {error ? (
                      <p className="small" role="alert" style={{ color: "var(--danger)", marginTop: 8 }}>
                        {error}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
