import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { QuickLiveButton } from "@/components/teacher/QuickLiveButton";

type TeacherHubProps = {
  teacherName: string;
  courseCount: number;
  upcomingCount: number;
  studentCount: number;
  isLive: boolean;
};

export function TeacherHub({
  teacherName,
  courseCount,
  upcomingCount,
  studentCount,
  isLive,
}: TeacherHubProps) {
  return (
    <>
      <div className="studio-head">
        <div>
          <p className="small muted" style={{ marginBottom: 4 }}>O&apos;qituvchi studiosi</p>
          <h2>Salom, {teacherName}</h2>
          <p className="muted small" style={{ marginTop: 6 }}>
            Zoom va Classroom kabi: avval darsni rejalang yoki hoziroq efirni boshlang. O&apos;quvchilar guruhda.
          </p>
        </div>
      </div>

      <div className="studio-kpis">
        <div className="studio-kpi">
          <span className="small muted">Kurs</span>
          <b>{courseCount}</b>
        </div>
        <div className="studio-kpi">
          <span className="small muted">Rejadagi dars</span>
          <b>{upcomingCount}</b>
        </div>
        <div className="studio-kpi">
          <span className="small muted">O&apos;quvchilar</span>
          <b>{studentCount}</b>
        </div>
        <div className="studio-kpi">
          <span className="small muted">Efir</span>
          <b>{isLive ? "Jonli" : "Yo'q"}</b>
        </div>
      </div>

      <div className="studio-hub">
        <article className="studio-card">
          <Icon name="play" size={22} />
          <h3>Jonli dars</h3>
          <p className="small muted">
            Hozir efir yoki rejadagi darsni Studio&apos;dan boshlang. Kamera brauzerda ochiladi — Zoom / Meet kabi. Talabalar 2/3-tarifda kiradi.
          </p>
          <div className="studio-card-actions">
            <QuickLiveButton />
            <Link href="/teacher" className="btn btn-sm">Kurslar</Link>
          </div>
        </article>
        <article className="studio-card">
          <Icon name="clock" size={22} />
          <h3>Darsni rejalash</h3>
          <p className="small muted">
            Mavzu, vaqt, qisqa matn va banner. Efirni keyin Studio&apos;dan boshlaysiz.
          </p>
          <Link href="/teacher/reja" className="btn btn-sm btn-primary">Reja qo&apos;shish</Link>
        </article>
        <article className="studio-card">
          <Icon name="users" size={22} />
          <h3>O&apos;quvchilar</h3>
          <p className="small muted">
            Kurs bo&apos;yicha kim yozilgan, qaysi mavzuni ochgan, qaysi kursga sertifikat.
          </p>
          <Link href="/teacher/group" className="btn btn-sm btn-primary">O&apos;quvchilar</Link>
        </article>
      </div>
    </>
  );
}
