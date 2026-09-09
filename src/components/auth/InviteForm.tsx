"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthLayout } from "./AuthLayout";
import { GlassField } from "./GlassField";
import styles from "./auth.module.css";

export function InviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyOpen, setAlreadyOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAlreadyOpen(false);
    if (fullName.trim().length < 2) {
      setError("Ism kamida 2 belgidan iborat bo'lsin");
      return;
    }
    if (password.length < 8) {
      setError("Parol kamida 8 belgidan iborat bo'lsin");
      return;
    }
    if (password !== confirm) {
      setError("Parollar mos kelmadi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName: fullName.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
        code?: string;
      };
      if (!res.ok) {
        setError(data.error || "Hisob ochilmadi");
        setAlreadyOpen(data.code === "already_registered");
        return;
      }
      const signinRes = await signIn("credentials", {
        email: data.email || email,
        password,
        redirect: false,
      });
      if (signinRes?.error) {
        router.push(`/login?email=${encodeURIComponent(data.email || email)}`);
        return;
      }
      router.push("/teacher");
      router.refresh();
    } catch {
      setError("Server javob bermadi. Internetni tekshirib qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h2 className={styles.title}>O&apos;qituvchi kabineti</h2>
      <p className={styles.subtitle}>
        Hisob {email} uchun. Parolni o&apos;zingiz belgilaysiz.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <GlassField
          id="invite-name"
          label="To'liq ism"
          value={fullName}
          onChange={setFullName}
          required
          autoComplete="name"
        />
        <GlassField
          id="invite-password"
          label="Parol (kamida 8 belgi)"
          type={showPw ? "text" : "password"}
          value={password}
          onChange={setPassword}
          required
          minLength={8}
          autoComplete="new-password"
          showToggle
          showPassword={showPw}
          onTogglePassword={() => setShowPw((s) => !s)}
        />
        <GlassField
          id="invite-confirm"
          label="Parolni tasdiqlang"
          type={showPw ? "text" : "password"}
          value={confirm}
          onChange={setConfirm}
          required
          autoComplete="new-password"
        />
        {error ? <div className={styles.errorText}>{error}</div> : null}
        {alreadyOpen ? (
          <p className={styles.bottomText} style={{ marginTop: 8 }}>
            <Link href={`/login?email=${encodeURIComponent(email)}`}>Kirish sahifasi</Link>
          </p>
        ) : null}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? "Saqlanmoqda..." : "Kabinetni ochish"}
        </button>
      </form>
    </AuthLayout>
  );
}
