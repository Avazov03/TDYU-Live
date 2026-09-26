"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CourseLifecycleStatus } from "@/generated/prisma/client";
import {
  COURSE_MIN_DESCRIPTION,
  isTeacherEditableLifecycle,
  lifecycleLabel,
} from "@/lib/course-review-policy";

export function TeacherCourseReviewPanel({
  course,
}: {
  course: {
    id: string;
    titleUz: string;
    descriptionUz: string;
    topicUz: string | null;
    lifecycleStatus: CourseLifecycleStatus | null;
    reviewReason: string | null;
    lessonCount: number;
  };
}) {
  const router = useRouter();
  const editable = isTeacherEditableLifecycle(course.lifecycleStatus);
  const [editing, setEditing] = useState(false);
  const [titleUz, setTitleUz] = useState(course.titleUz);
  const [descriptionUz, setDescriptionUz] = useState(course.descriptionUz);
  const [topicUz, setTopicUz] = useState(course.topicUz ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(`/api/teacher/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titleUz, descriptionUz, topicUz }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Saqlanmadi");
      return false;
    }
    setEditing(false);
    setNotice("Saqlandi");
    router.refresh();
    return true;
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(`/api/teacher/courses/${course.id}/submit`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Yuborilmadi");
      return;
    }
    setNotice("Tekshiruvga yuborildi. Admin javobi bildirishnomada keladi.");
    router.refresh();
  };

  const tone =
    course.lifecycleStatus === "rejected"
      ? "danger"
      : course.lifecycleStatus === "approved"
        ? "success"
        : "pending";

  return (
    <div data-testid="teacher-course-review" data-course-id={course.id}>
      <p className="lx-kicker">
        <span className={`badge ${tone}`}>{lifecycleLabel(course.lifecycleStatus)}</span>
      </p>
      <h3>{course.titleUz}</h3>
      <p className="small muted" style={{ margin: "0 0 10px" }}>
        {course.lessonCount} dars rejada ·{" "}
        {course.lifecycleStatus === "approved"
          ? "Admin tasdiqladi — nashr kutilmoqda"
          : course.lifecycleStatus === "submitted" || course.lifecycleStatus === "in_review"
            ? "Admin tekshirmoqda — hozircha tahrirlab bo‘lmaydi"
            : course.lifecycleStatus === "rejected"
              ? "Kurs rad etildi"
              : "O‘quvchilarga ko‘rinmaydi — tekshiruvdan o‘tishi kerak"}
      </p>

      {course.reviewReason &&
      (course.lifecycleStatus === "changes_requested" || course.lifecycleStatus === "rejected") ? (
        <div className="teacher-course-next" role="note">
          <p className="lx-kicker">Admin izohi</p>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{course.reviewReason}</p>
        </div>
      ) : null}

      {editing ? (
        <form
          className="soft-form"
          style={{ marginTop: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="field">
            <label htmlFor={`t-${course.id}`}>Kurs nomi</label>
            <input
              id={`t-${course.id}`}
              value={titleUz}
              onChange={(e) => setTitleUz(e.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div className="field">
            <label htmlFor={`d-${course.id}`}>Tavsif (kamida {COURSE_MIN_DESCRIPTION} belgi)</label>
            <textarea
              id={`d-${course.id}`}
              value={descriptionUz}
              onChange={(e) => setDescriptionUz(e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>
          <div className="field">
            <label htmlFor={`m-${course.id}`}>Mavzu</label>
            <input
              id={`m-${course.id}`}
              value={topicUz}
              onChange={(e) => setTopicUz(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="row gap-8" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
              Saqlash
            </button>
            <button className="btn btn-sm" type="button" onClick={() => setEditing(false)}>
              Bekor
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="small" role="alert" style={{ color: "var(--danger)", marginTop: 8 }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="small" role="status" style={{ color: "var(--success)", marginTop: 8 }}>
          {notice}
        </p>
      ) : null}

      {editable && !editing ? (
        <div className="row gap-8" style={{ flexWrap: "wrap", marginTop: 12 }}>
          <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void submit()}>
            {course.lifecycleStatus === "changes_requested" ? "Qayta yuborish" : "Tekshiruvga yuborish"}
          </button>
          <button className="btn btn-sm" type="button" onClick={() => setEditing(true)}>
            Tahrirlash
          </button>
          <Link href="/teacher/reja" className="btn btn-sm">
            Reja
          </Link>
        </div>
      ) : null}
    </div>
  );
}
