"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import type { AdminReviewCourse } from "@/lib/admin-courses";
import { lifecycleLabel } from "@/lib/course-review-policy";
import { formatSom } from "@/lib/tariffs";

type Action = "start_review" | "request_changes" | "reject" | "approve" | "publish";
type Status = AdminReviewCourse["lifecycleStatus"];
type Filter = "action" | Status;

const DECISION_LABEL: Record<string, string> = {
  submitted: "Yuborildi",
  changes_requested: "O‘zgartirish so‘raldi",
  rejected: "Rad etildi",
  approve_publish: "Tasdiqlandi",
};

const FILTERS: { id: Filter; label: string; statuses: Status[] }[] = [
  { id: "action", label: "Harakat kerak", statuses: ["submitted", "in_review", "approved"] },
  { id: "submitted", label: "Yangi", statuses: ["submitted"] },
  { id: "in_review", label: "Tekshirilmoqda", statuses: ["in_review"] },
  { id: "approved", label: "Nashr kutmoqda", statuses: ["approved"] },
  { id: "changes_requested", label: "Qaytarilgan", statuses: ["changes_requested"] },
  { id: "rejected", label: "Rad etilgan", statuses: ["rejected"] },
];

const DAY_MS = 86_400_000;

function tone(status: Status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "pending";
}

function waitingLabel(status: Status, sinceIso: string, nowMs: number) {
  const days = Math.floor((nowMs - new Date(sinceIso).getTime()) / DAY_MS);
  if (status === "changes_requested") return days <= 0 ? "bugun qaytarildi" : `${days} kundan beri o‘qituvchida`;
  if (status === "rejected") return days <= 0 ? "bugun rad etildi" : `${days} kun oldin rad etildi`;
  if (status === "approved") return days <= 0 ? "bugun tasdiqlandi" : `${days} kundan beri nashr kutmoqda`;
  return days <= 0 ? "bugun keldi" : `${days} kundan beri kutmoqda`;
}

export function AdminCourseReviewQueue({ courses, nowIso }: { courses: AdminReviewCourse[]; nowIso: string }) {
  const router = useRouter();
  const nowMs = new Date(nowIso).getTime();
  const [filter, setFilter] = useState<Filter>("action");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const countOf = (statuses: Status[]) => courses.filter((c) => statuses.includes(c.lifecycleStatus)).length;
  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const visible = courses.filter((c) => active.statuses.includes(c.lifecycleStatus));

  const openCourse = (course: AdminReviewCourse | null) => {
    setOpenId(course?.id ?? null);
    setError("");
    setReason("");
    setPrice(course?.listPrice ? String(course.listPrice) : "");
    setCapacity(course?.capacity ? String(course.capacity) : "");
  };

  const act = async (course: AdminReviewCourse, action: Action) => {
    if (action === "reject" || action === "request_changes") {
      const ok = await confirmAction(
        action === "reject"
          ? {
              title: "Kursni rad etasizmi?",
              message: `«${course.titleUz}» rad etiladi va o‘qituvchi uni qayta yubora olmaydi. Sabab o‘qituvchiga ko‘rsatiladi.`,
              confirmLabel: "Rad etish",
            }
          : {
              title: "Kursni qayta ishlashga qaytarasizmi?",
              message: `«${course.titleUz}» o‘qituvchiga qaytariladi — u tuzatib, yana tekshiruvga yuboradi.`,
              confirmLabel: "Qaytarish",
              tone: "default",
            },
      );
      if (!ok) return;
    }
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
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) {
      setError(data.error || "Amal bajarilmadi");
      return;
    }
    setNotice(`«${course.titleUz}» — ${lifecycleLabel(data.lifecycleStatus)}`);
    if (action !== "start_review") setOpenId(null);
    setReason("");
    setPrice("");
    setCapacity("");
    router.refresh();
  };

  return (
    <section className="lx-review" data-testid="admin-review-queue">
      <div className="lx-review-filters" role="tablist" aria-label="Holat bo‘yicha">
        {FILTERS.map((f) => {
          const n = countOf(f.statuses);
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`lx-review-chip${filter === f.id ? " is-on" : ""}`}
              onClick={() => {
                setFilter(f.id);
                openCourse(null);
              }}
            >
              {f.label}
              <span className="lx-review-chip-n">{n}</span>
            </button>
          );
        })}
      </div>

      {notice ? (
        <p className="lx-form-done" role="status">
          {notice}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="empty lx-review-empty">
          {filter === "action"
            ? "Hozircha harakat talab qiladigan kurs yo‘q. O‘qituvchi kursni tekshiruvga yuborganda shu yerda paydo bo‘ladi."
            : "Bu holatda kurs yo‘q."}
        </div>
      ) : (
        <div className="lx-stack">
          {visible.map((course) => {
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
                  className="admin-course-main lx-review-main"
                  aria-expanded={open}
                  onClick={() => openCourse(open ? null : course)}
                >
                  <div className="admin-course-title">
                    <h4>{course.titleUz}</h4>
                    <p className="small muted" style={{ margin: 0 }}>
                      {course.teacherName} · {course.subjectName} · {course.lessons.length} dars
                      {course.listPrice ? ` · ${formatSom(course.listPrice)}` : ""}
                    </p>
                  </div>
                  <span className="lx-review-wait small muted">
                    {waitingLabel(course.lifecycleStatus, course.waitingSinceIso, nowMs)}
                  </span>
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
                    <div className="small muted" style={{ marginBottom: 4 }}>
                      Dars rejasi · {course.lessons.length} ta
                    </div>
                    {course.lessons.length > 0 ? (
                      <ol className="lx-review-lessons small">
                        {course.lessons.map((l) => (
                          <li key={l.id}>
                            <span>{l.titleUz}</span>
                            <span className="muted">{l.whenLabel}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="small muted" style={{ margin: "0 0 12px" }}>Dars qo‘shilmagan.</p>
                    )}

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
                        <div className="lx-dialog-row">
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
                        </div>
                        <div className="field">
                          <label htmlFor={`reason-${course.id}`}>Sabab (o‘zgartirish yoki rad etish uchun)</label>
                          <textarea
                            id={`reason-${course.id}`}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="O‘qituvchiga nima tuzatish kerakligini yozing"
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
                        <span className="small muted">Nashrdan keyin o‘quvchilar kursni ko‘radi va sotib oladi.</span>
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
