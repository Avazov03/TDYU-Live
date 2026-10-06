"use client";

import { useState, useId } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

type SettingsData = {
  fullName: string;
  email: string;
  language: string;
  theme: string;
  role: string;
  telegramChatId?: string | null;
  telegramLinkPayload: string | null;
};

export function SettingsForm({ initial }: { initial: SettingsData }) {
  const fid = useId();
  const { theme, setTheme } = useTheme();
  const [linked, setLinked] = useState(Boolean(initial.telegramChatId));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "") ?? "";
  const deepLink =
    bot && initial.telegramLinkPayload
      ? `https://t.me/${bot}?start=${initial.telegramLinkPayload}`
      : null;

  const saveTelegram = async () => {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/settings/telegram", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramChatId: "" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Saqlanmadi");
      return;
    }
    setLinked(false);
    setMsg("Telegram uzildi.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Hisob</h3>
        <div className="field">
          <label htmlFor={`${fid}-1`}>To&apos;liq ism</label>
          <input id={`${fid}-1`} readOnly value={initial.fullName} />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-2`}>Email</label>
          <input id={`${fid}-2`} readOnly value={initial.email} />
        </div>
        <div className="field">
          <label htmlFor={`${fid}-3`}>Rol</label>
          <input id={`${fid}-3`} readOnly value={initial.role} />
        </div>
        <p className="small muted">Ism va email shu yerda o‘zgarmaydi.</p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Telegram bildirishnomalar</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Telegram ixtiyoriy. Ulash faqat bot orqali. Sayt bildirishnomalari asosiy kanal.
        </p>
        {deepLink ? (
          <p style={{ marginBottom: 12 }}>
            <a className="btn btn-primary btn-sm" href={deepLink} target="_blank" rel="noreferrer">
              Botni ulash (@{bot})
            </a>
          </p>
        ) : (
          <p className="small muted" style={{ marginBottom: 12 }}>
            Bot hozircha ulanmagan. Sayt bildirishnomalari ishlayveradi.
          </p>
        )}
        <p className="small">{linked ? "Telegram ulangan." : "Telegram ulanmagan."}</p>
        {linked ? (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void saveTelegram()}>
            {busy ? "Saqlanmoqda..." : "Uzish"}
          </button>
        ) : null}
        {msg ? <p className="small muted" style={{ marginTop: 8 }}>{msg}</p> : null}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Interfeys</h3>
        <div className="field">
          <label htmlFor={`${fid}-5`}>Til</label>
          <input id={`${fid}-5`} readOnly value={initial.language.toUpperCase()} />
        </div>
        <div className="row gap-12" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span>Mavzu: {theme === "dark" ? "Qorong'u" : "Yorug'"}</span>
          <AnimatedThemeToggler theme={theme} onThemeChange={setTheme} className="iconbtn" />
        </div>
      </div>
    </div>
  );
}
