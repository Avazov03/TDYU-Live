"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthLayout } from "./AuthLayout";
import { GlassField } from "./GlassField";
import styles from "./auth.module.css";

export function InviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
        body: JSON.stringify({ token, fullName, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
      if (!res.ok) {
        setError(data.error || "Hisob ochilmadi");
        return;
      }
      const signinRes = await signIn("credentials", {
        email: data.email || email,
        password,
        redirect: false,
      });
      if (signinRes?.error) {
        router.push("/login");
        return;
      }
      router.push("/teacher");
      router.refresh();
    } catch {
      setError("Server javob bermadi. Qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className={styles.form}>
        <GlassField label="To'liq ism" value={fullName} onChange={setFullName} required />
        <GlassField label="Parol" type="password" value={password} onChange={setPassword} required />
        <GlassField label="Parolni tasdiqlang" type="password" value={confirm} onChange={setConfirm} required />
        {error ? <div className={styles.errorText}>{error}</div> : null}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? "Saqlanmoqda..." : "Kabinetni ochish"}
        </button>
      </form>
    </AuthLayout>
  );
}
