"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthLayout } from "./AuthLayout";
import { GlassField } from "./GlassField";
import styles from "./auth.module.css";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.1 8.1 3l5.7-5.7C34.6 6 29.6 4 24 4c-7.6 0-14.1 4.3-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.1-5l-6.5-5.5C29.5 35.4 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.8 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5C41.4 35.7 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "Bu email boshqa usul bilan ro'yxatdan o'tgan. Email va parol bilan kiring.",
  AccessDenied: "Kirish rad etildi. Hisobingiz bloklangan bo'lishi mumkin.",
  Configuration: "Kirish sozlamalarida xatolik. Administrator bilan bog'laning.",
  Default: "Kirishda xatolik yuz berdi. Qayta urinib ko'ring.",
};

type LoginFormProps = {
  googleEnabled?: boolean;
};

export function LoginForm({ googleEnabled = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const oauthError = searchParams.get("error");
  const displayError =
    error ??
    (oauthError ? AUTH_ERROR_MESSAGES[oauthError] ?? AUTH_ERROR_MESSAGES.Default : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email yoki parol noto'g'ri");
      return;
    }
    router.push("/go");
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/go" });
  }

  return (
    <AuthLayout>
      <h2 className={styles.title}>Kirish</h2>
      <p className={styles.subtitle}>Hisobingizga kirish uchun ma&apos;lumotlarni kiriting</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <GlassField
          id="login-email"
          label="Email manzilingiz"
          type="email"
          value={email}
          onChange={setEmail}
          required
          autoComplete="email"
        />

        <GlassField
          id="login-password"
          label="Parolingiz"
          type={showPw ? "text" : "password"}
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
          showToggle
          showPassword={showPw}
          onTogglePassword={() => setShowPw((s) => !s)}
        />

        {displayError && <div className={styles.errorText}>{displayError}</div>}

        <div className={styles.forget}>
          <label className={styles.remember}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Meni eslab qol
          </label>
          <button
            type="button"
            className={styles.forgot}
            onClick={() => setError("Parolni tiklash tez kunda qo'shiladi")}
          >
            Parolni unutdingizmi?
          </button>
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading || googleLoading}>
          {loading ? "Kirilmoqda..." : "Kirish"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className={styles.divider}>yoki</div>

          <button
            type="button"
            className={styles.altBtn}
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
          >
            <GoogleIcon />
            {googleLoading ? "Google ochilmoqda..." : "Google orqali kirish"}
          </button>
        </>
      )}

      <p className={styles.bottomText}>
        Hisobingiz yo&apos;qmi? <Link href="/register">Ro&apos;yxatdan o&apos;tish</Link>
      </p>
    </AuthLayout>
  );
}
