"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AceternityAuthLogo,
  AuthField,
  AuthGradientShell,
  AUTH_PRIMARY_BTN_CLASS,
} from "./AuthGradientShell";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(
    token ? null : "Havola noto'g'ri. Parolni tiklashni qaytadan so'rang.",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Havola noto'g'ri. Parolni tiklashni qaytadan so'rang.");
      return;
    }
    if (password !== confirm) {
      setError("Parollar mos kelmadi");
      return;
    }
    if (password.length < 8) {
      setError("Parol kamida 8 belgidan iborat bo'lishi kerak");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Parol yangilanmadi");
        return;
      }
      router.push("/login?reset=1");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGradientShell>
      <AceternityAuthLogo />
      <h1 className="mt-4 text-left text-3xl font-medium tracking-tight text-black md:text-4xl lg:text-4xl dark:text-white">
        Yangi parol
      </h1>
      <h2 className="mt-4 max-w-xl text-left text-sm font-medium tracking-tight text-gray-600 md:text-sm lg:text-base dark:text-gray-300">
        Kamida 8 belgidan iborat yangi parol o&apos;rnating.
      </h2>

      <form className="mt-6 flex flex-col gap-8" onSubmit={handleSubmit}>
        <AuthField
          id="reset-password"
          label="Yangi parol"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Create a password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <AuthField
          id="reset-confirm"
          label="Parolni tasdiqlang"
          type="password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Create a password"
          required
          autoComplete="new-password"
        />

        {error && (
          <div className="text-sm text-red-500" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !token}
          className={AUTH_PRIMARY_BTN_CLASS}
        >
          {loading ? "Saqlanmoqda..." : "Parolni saqlash"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-orange-500 hover:underline"
        >
          Yangi havola so&apos;rash
        </Link>
      </div>
    </AuthGradientShell>
  );
}
