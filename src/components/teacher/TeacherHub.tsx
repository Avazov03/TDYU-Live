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
            Hozir efir yoki rejadagi darsni Studio&apos;dan boshlang. OBS ulanadi, talabalar 2/3-tarifda ko&apos;radi.
          </p>
          <div className="studio-card-actions">
            <QuickLiveButton />
            <a href="#live" className="btn btn-sm">Studioga</a>
          </div>
        </article>
        <article className="studio-card">
          <Icon name="clock" size={22} />
          <h3>Darsni rejalash</h3>
          <p className="small muted">
            Mavzu, sana va vaqt. Keyin shu sahifadan «Efirni boshlash». Zoomdagi Schedule meeting.
          </p>
          <a href="#reja" className="btn btn-sm btn-primary">Reja qo&apos;shish</a>
        </article>
        <article className="studio-card">
          <Icon name="users" size={22} />
          <h3>O&apos;quvchilar</h3>
          <p className="small muted">
            Kim obuna, qaysi tarif, davomat va sertifikat. Classroomdagi People.
          </p>
          <Link href="/teacher/group" className="btn btn-sm btn-primary">Guruhni ochish</Link>
        </article>
      </div>
    </>
  );
}
