"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AceternityAuthLogo,
  AuthField,
  AuthGradientShell,
  AUTH_PRIMARY_BTN_CLASS,
} from "./AuthGradientShell";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevLink(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "So'rov yuborilmadi");
        return;
      }
      setMessage(data.message ?? "Agar email topilsa, havola yuboriladi.");
      if (typeof data.devResetUrl === "string") setDevLink(data.devResetUrl);
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
        Parolni tiklash
      </h1>
      <h2 className="mt-4 max-w-xl text-left text-sm font-medium tracking-tight text-gray-600 md:text-sm lg:text-base dark:text-gray-300">
        Emailingizni yozing — tiklash havolasini yuboramiz.
      </h2>

      <form className="mt-6 flex flex-col gap-8" onSubmit={handleSubmit}>
        <AuthField
          id="forgot-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="youremail@yourdomain.com"
          required
          autoComplete="email"
        />

        {error && (
          <div className="text-sm text-red-500" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="text-sm text-emerald-500" role="status">
            {message}
          </div>
        )}
        {devLink && (
          <p className="break-all text-xs text-gray-500 dark:text-neutral-400">
            Dev havola:{" "}
            <Link href={devLink} className="text-orange-500 hover:underline">
              {devLink}
            </Link>
          </p>
        )}

        <button type="submit" disabled={loading} className={AUTH_PRIMARY_BTN_CLASS}>
          {loading ? "Yuborilmoqda..." : "Havola yuborish"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-orange-500 hover:underline"
        >
          Kirishga qaytish
        </Link>
      </div>
    </AuthGradientShell>
  );
}
