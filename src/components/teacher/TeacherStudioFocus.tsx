import Link from "next/link";
import { QuickLiveButton } from "@/components/teacher/QuickLiveButton";

export type AttentionStudent = {
  userId: string;
  fullName: string;
  reason: string;
  courseTitle: string;
};

type TeacherStudioFocusProps = {
  teacherName: string;
  courseCount: number;
  upcomingCount: number;
  studentCount: number;
  isLive: boolean;
  nextLesson: {
    id: string;
    titleUz: string;
    courseTitle: string;
    whenLabel: string;
    status: "live" | "scheduled" | "ended";
  } | null;
  attention: AttentionStudent[];
  pendingGrades: number;
};

export function TeacherStudioFocus({
  teacherName,
  courseCount,
  upcomingCount,
  studentCount,
  isLive,
  nextLesson,
  attention,
  pendingGrades,
}: TeacherStudioFocusProps) {
  return (
    <div className="lx-board teacher-focus">
      <p className="lx-kicker">Studio</p>
      <h2>Salom, {teacherName}</h2>
      <p className="muted small lx-lead">
        Bugungi asosiy ish: keyingi dars, diqqat talabalar, efir.
      </p>

      <div className="teacher-focus-grid">
        <section className="teacher-focus-card teacher-focus-primary">
          <p className="lx-kicker">{isLive ? "Hozir jonli" : "Keyingi dars"}</p>
          {nextLesson ? (
            <>
              <h3>{nextLesson.titleUz}</h3>
              <p className="small muted" style={{ margin: "0 0 12px" }}>
                {nextLesson.courseTitle} · {nextLesson.whenLabel}
              </p>
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                <Link href={`/teacher/live/${nextLesson.id}`} className="btn btn-primary btn-sm">
                  {isLive ? "Efirga qaytish" : "Studioga — shu dars"}
                </Link>
                {!isLive ? <QuickLiveButton /> : null}
                <Link href="/teacher/reja" className="btn btn-sm">
                  Reja
                </Link>
              </div>
            </>
          ) : (
            <>
              <h3>Hali rejadagi dars yo‘q</h3>
              <p className="small muted" style={{ margin: "0 0 12px" }}>
                Mavzu qo‘shing yoki hoziroq efirni boshlang.
              </p>
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                <QuickLiveButton />
                <Link href="/teacher/reja" className="btn btn-sm btn-primary">
                  Reja qo‘shish
                </Link>
              </div>
            </>
          )}
        </section>

        <section className="teacher-focus-card">
          <p className="lx-kicker">Diqqat · {attention.length}</p>
          <h3 style={{ fontSize: 18, marginBottom: 10 }}>Kimga e’tibor</h3>
          {attention.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              Hozircha ogohlantirish yo‘q — guruh yaxshi.
            </p>
          ) : (
            <div className="lx-stack">
              {attention.map((s) => (
                <div key={`${s.userId}-${s.courseTitle}`} className="teacher-focus-student">
                  <div>
                    <strong>{s.fullName}</strong>
                    <p className="small muted" style={{ margin: 0 }}>
                      {s.courseTitle} · {s.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ marginTop: 12 }}>
            <Link href="/teacher/group" className="btn btn-sm">
              Guruhga
            </Link>
          </p>
        </section>
      </div>

      <div className="studio-kpis" style={{ marginTop: 16 }}>
        <div className="studio-kpi">
          <span className="small muted">Kurs</span>
          <b>{courseCount}</b>
        </div>
        <div className="studio-kpi">
          <span className="small muted">Reja</span>
          <b>{upcomingCount}</b>
        </div>
        <div className="studio-kpi">
          <span className="small muted">O‘quvchilar</span>
          <b>{studentCount}</b>
        </div>
        <div className="studio-kpi">
          <span className="small muted">Tekshiruv</span>
          <b>{pendingGrades}</b>
        </div>
      </div>

      {pendingGrades > 0 ? (
        <Link href="/teacher/assignments" className="lx-row" style={{ marginTop: 12 }}>
          <div>
            <p className="lx-kicker">Topshiriq</p>
            <h3>{pendingGrades} ta ish baholanmagan</h3>
          </div>
          <span className="lx-go">Ochish</span>
        </Link>
      ) : null}
    </div>
  );
}
