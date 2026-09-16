import Link from "next/link";

type Cap = {
  href: string;
  title: string;
  can: string[];
  hint: string;
  meta?: string;
};

export function AdminCapabilities({
  students,
  teachers,
  courses,
  activeSubs,
  pendingInvites,
}: {
  students: number;
  teachers: number;
  courses: number;
  activeSubs: number;
  pendingInvites: number;
}) {
  const caps: Cap[] = [
    {
      href: "/admin/users",
      title: "O‘quvchilar",
      meta: `${students} ta`,
      can: ["Bloklash / ochish", "Parol (super admin)", "Obunani +30 kun / bekor"],
      hint: "Kim to‘lagan, qachon tugaydi — shu yerdan boshqarasiz.",
    },
    {
      href: "/admin/teachers",
      title: "O‘qituvchilar",
      meta: pendingInvites > 0 ? `${teachers} · ${pendingInvites} invite` : `${teachers} ta`,
      can: ["Invite yaratish", "Bloklash", "Parol / impersonate"],
      hint: "Yangi o‘qituvchini havola bilan ochasiz.",
    },
    {
      href: "/admin/courses",
      title: "Kurslar",
      meta: `${courses} ta`,
      can: ["Yangi kurs", "Tahrirlash", "Nashr / yashirish"],
      hint: "Narx, nom, nashr holati — bir joyda.",
    },
    {
      href: "/admin/payments",
      title: "To‘lovlar",
      meta: `${activeSubs} faol obuna`,
      can: ["Filtr va qidiruv", "Summa / tarif kesimi"],
      hint: "Kirim va demo to‘lovlarni kuzatasiz.",
    },
  ];

  return (
    <section className="admin-caps" aria-label="Admin imkoniyatlari">
      <div className="admin-caps-head">
        <div>
          <p className="lx-kicker">Sizning imkoniyatlaringiz</p>
          <h3>Nima qila olasiz — bir qarashda</h3>
        </div>
        <p className="small muted admin-caps-note">
          Har bir kartochka amal sahifasiga olib boradi. Avval shu yerdan yo‘naling.
        </p>
      </div>
      <div className="admin-caps-grid">
        {caps.map((cap) => (
          <Link key={cap.href} href={cap.href} className="admin-cap-card">
            <div className="admin-cap-top">
              <strong>{cap.title}</strong>
              {cap.meta ? <span className="badge accent">{cap.meta}</span> : null}
            </div>
            <p className="small muted">{cap.hint}</p>
            <ul className="admin-cap-list">
              {cap.can.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <span className="admin-cap-go">Ochish →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
