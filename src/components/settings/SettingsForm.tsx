"use client";

import { useTheme } from "@/components/providers/ThemeProvider";

type SettingsData = {
  fullName: string;
  email: string;
  language: string;
  theme: string;
  role: string;
};

export function SettingsForm({ initial }: { initial: SettingsData }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Hisob</h3>
        <div className="field">
          <label>To&apos;liq ism</label>
          <input readOnly value={initial.fullName} />
        </div>
        <div className="field">
          <label>Email</label>
          <input readOnly value={initial.email} />
        </div>
        <div className="field">
          <label>Rol</label>
          <input readOnly value={initial.role} />
        </div>
        <p className="small muted">Ism, email va parolni tahrirlash keyingi yangilanishda qo&apos;shiladi.</p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Interfeys</h3>
        <div className="field">
          <label>Til</label>
          <input readOnly value={initial.language.toUpperCase()} />
        </div>
        <div className="row gap-12" style={{ justifyContent: "space-between" }}>
          <span>Mavzu: {theme === "dark" ? "Qorong'u" : "Yorug'"}</span>
          <button type="button" className="btn btn-sm" onClick={toggleTheme}>
            Mavzuni almashtirish
          </button>
        </div>
      </div>
    </div>
  );
}
