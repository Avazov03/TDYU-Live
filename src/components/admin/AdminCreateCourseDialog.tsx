"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

type Option = { id: string; nameUz: string };

const EMPTY = { titleUz: "", descriptionUz: "", teacherId: "", facultyId: "", subjectId: "" };

export function AdminCreateCourseDialog({
  teachers,
  faculties,
  subjects,
  reviewFlow,
}: {
  teachers: { id: string; fullName: string }[];
  faculties: Option[];
  subjects: (Option & { facultyId: string })[];
  reviewFlow: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(EMPTY);
  const [prices, setPrices] = useState({ priceT1: "150000", priceT2: "250000", priceT3: "400000" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY, value: string) => {
    setForm((f) => ({ ...f, [key]: value, ...(key === "facultyId" ? { subjectId: "" } : {}) }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const open = () => {
    setCreated(null);
    setServerError("");
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  const validate = () => {
    const next: typeof errors = {};
    if (form.titleUz.trim().length < 2) next.titleUz = "Kurs nomini kiriting";
    if (form.descriptionUz.trim().length < 2) next.descriptionUz = "Qisqa tavsif yozing";
    if (!form.teacherId) next.teacherId = "O‘qituvchini tanlang";
    if (!form.facultyId) next.facultyId = "Fakultetni tanlang";
    if (!form.subjectId) next.subjectId = "Fanni tanlang";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setServerError("");
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ...(reviewFlow
          ? {}
          : {
              priceT1: Number(prices.priceT1.replace(/\s/g, "")),
              priceT2: Number(prices.priceT2.replace(/\s/g, "")),
              priceT3: Number(prices.priceT3.replace(/\s/g, "")),
            }),
      }),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      setServerError(data.error || "Tarmoq xatosi — qayta urinib ko‘ring");
      return;
    }
    setCreated(form.titleUz.trim());
    setForm(EMPTY);
    router.refresh();
  };

  const field = (key: keyof typeof EMPTY) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `acc-${key}-err` : undefined,
  });
  const err = (key: keyof typeof EMPTY) =>
    errors[key] ? (
      <span id={`acc-${key}-err`} className="lx-field-err">
        {errors[key]}
      </span>
    ) : null;

  return (
    <>
      <button type="button" className="btn btn-primary lx-acc-open" onClick={open}>
        <Plus size={16} aria-hidden />
        Kurs qo‘shish
      </button>
      <dialog ref={ref} className="lx-dialog" aria-labelledby="acc-title" onClose={() => setErrors({})}>
        <div className="lx-dialog-head">
          <h2 id="acc-title">Yangi kurs</h2>
          <button type="button" className="iconbtn" onClick={close} aria-label="Yopish">
            <X size={18} aria-hidden />
          </button>
        </div>

        {created ? (
          <div className="lx-dialog-body" data-testid="admin-course-created">
            <p className="lx-dialog-done">
              <strong>«{created}» {reviewFlow ? "qoralama sifatida yaratildi." : "yaratildi."}</strong>
            </p>
            {reviewFlow ? (
              <p className="lx-dialog-note">
                O‘quvchilarga hali ko‘rinmaydi. O‘qituvchi darslarni rejalashtirib, tekshiruvga yuboradi — keyin
                «Tekshiruv» bo‘limida narxni belgilab tasdiqlaysiz.
              </p>
            ) : null}
            <div className="lx-dialog-actions">
              <button type="button" className="btn" onClick={() => setCreated(null)}>
                Yana qo‘shish
              </button>
              <button type="button" className="btn btn-primary" onClick={close}>
                Tayyor
              </button>
            </div>
          </div>
        ) : (
          <form className="lx-dialog-body soft-form" onSubmit={submit} noValidate>
            {reviewFlow ? (
              <p className="lx-dialog-note">
                Kurs qoralama bo‘lib yaratiladi. Narx va nashr — tekshiruvda, o‘qituvchi darslarni qo‘shgach.
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="acc-titleUz">Kurs nomi</label>
              <input
                id="acc-titleUz"
                value={form.titleUz}
                onChange={(e) => set("titleUz", e.target.value)}
                placeholder="Masalan: Raqamli huquq asoslari"
                {...field("titleUz")}
              />
              {err("titleUz")}
            </div>
            <div className="field">
              <label htmlFor="acc-descriptionUz">Tavsif</label>
              <textarea
                id="acc-descriptionUz"
                value={form.descriptionUz}
                onChange={(e) => set("descriptionUz", e.target.value)}
                placeholder="Kurs kimlar uchun va nimani o‘rgatadi"
                rows={3}
                {...field("descriptionUz")}
              />
              {err("descriptionUz")}
            </div>
            <div className="field">
              <label htmlFor="acc-teacherId">O‘qituvchi</label>
              <select
                id="acc-teacherId"
                value={form.teacherId}
                onChange={(e) => set("teacherId", e.target.value)}
                {...field("teacherId")}
              >
                <option value="">Tanlang…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
              {err("teacherId")}
            </div>
            <div className="lx-dialog-row">
              <div className="field">
                <label htmlFor="acc-facultyId">Fakultet</label>
                <select
                  id="acc-facultyId"
                  value={form.facultyId}
                  onChange={(e) => set("facultyId", e.target.value)}
                  {...field("facultyId")}
                >
                  <option value="">Tanlang…</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nameUz}
                    </option>
                  ))}
                </select>
                {err("facultyId")}
              </div>
              <div className="field">
                <label htmlFor="acc-subjectId">Fan</label>
                <select
                  id="acc-subjectId"
                  value={form.subjectId}
                  onChange={(e) => set("subjectId", e.target.value)}
                  disabled={!form.facultyId}
                  {...field("subjectId")}
                >
                  <option value="">{form.facultyId ? "Tanlang…" : "Avval fakultet"}</option>
                  {subjects
                    .filter((s) => s.facultyId === form.facultyId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameUz}
                      </option>
                    ))}
                </select>
                {err("subjectId")}
              </div>
            </div>
            {reviewFlow ? null : (
              <div className="lx-dialog-row is-3">
                {(["priceT1", "priceT2", "priceT3"] as const).map((key, i) => (
                  <div className="field" key={key}>
                    <label htmlFor={`acc-${key}`}>{i + 1}-tarif (so‘m)</label>
                    <input
                      id={`acc-${key}`}
                      inputMode="numeric"
                      value={prices[key]}
                      onChange={(e) => setPrices((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
            {serverError ? (
              <p className="lx-field-err" role="alert">
                {serverError}
              </p>
            ) : null}
            <div className="lx-dialog-actions">
              <button type="button" className="btn" onClick={close}>
                Bekor qilish
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saqlanmoqda…" : reviewFlow ? "Qoralama yaratish" : "Saqlash"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
