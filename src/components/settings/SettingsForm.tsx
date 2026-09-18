"use client";

import { useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

type SettingsData = {
  fullName: string;
  email: string;
  language: string;
  theme: string;
  role: string;
  telegramChatId?: string | null;
  userId: string;
};

export function SettingsForm({ initial }: { initial: SettingsData }) {
  const { theme, setTheme } = useTheme();
  const [chatId, setChatId] = useState(initial.telegramChatId ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, "") ?? "";
  const deepLink = bot ? `https://t.me/${bot}?start=link_${initial.userId}` : null;

  const saveTelegram = async () => {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/settings/telegram", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramChatId: chatId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Saqlanmadi");
      return;
    }
    setMsg("Telegram saqlandi.");
  };

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
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Telegram bildirishnomalar</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Dars eslatmasi, kutish xonasi va jonli efir shu yerga ham keladi (bot token sozlanganda).
        </p>
        {deepLink ? (
          <p style={{ marginBottom: 12 }}>
            <a className="btn btn-primary btn-sm" href={deepLink} target="_blank" rel="noreferrer">
              Botni ulash
            </a>
          </p>
        ) : (
          <p className="small muted" style={{ marginBottom: 12 }}>
            Bot username hali yo‘q — Chat ID ni qo‘lda kiriting yoki admin `TELEGRAM_BOT_TOKEN` ni ulang.
          </p>
        )}
        <div className="field">
          <label>Telegram Chat ID</label>
          <input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Masalan: 123456789"
          />
        </div>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void saveTelegram()}>
          {busy ? "Saqlanmoqda..." : "Saqlash"}
        </button>
        {msg ? <p className="small muted" style={{ marginTop: 8 }}>{msg}</p> : null}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Interfeys</h3>
        <div className="field">
          <label>Til</label>
          <input readOnly value={initial.language.toUpperCase()} />
        </div>
        <div className="row gap-12" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span>Mavzu: {theme === "dark" ? "Qorong'u" : "Yorug'"}</span>
          <AnimatedThemeToggler theme={theme} onThemeChange={setTheme} className="iconbtn" />
        </div>
      </div>
    </div>
  );
}
