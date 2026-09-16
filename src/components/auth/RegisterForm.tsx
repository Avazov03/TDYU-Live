"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { BRAND } from "@/lib/brand";
import {
  AceternityAuthLogo,
  AppleSocialIcon,
  AuthField,
  AuthGradientShell,
  FacebookSocialIcon,
  GoogleSocialIcon,
  SOCIAL_BTN_CLASS,
} from "./AuthGradientShell";

type RegisterFormProps = {
  googleEnabled?: boolean;
};

export function RegisterForm({ googleEnabled = false }: RegisterFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Ro'yxatdan o'tishda xatolik yuz berdi");
        return;
      }

      const signinRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (signinRes?.error) {
        setError(
          "Hisob yaratildi, lekin avtomatik kirish amalga oshmadi. Kirish sahifasidan kiring.",
        );
        return;
      }
      router.push("/go");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!googleEnabled) return;
    setError(null);
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/go" });
  }

  return (
    <AuthGradientShell>
      <AceternityAuthLogo />
      <h1 className="mt-4 text-left text-3xl font-medium tracking-tight text-black md:text-4xl lg:text-4xl dark:text-white">
        Hisob yarating
      </h1>
      <h2 className="mt-4 max-w-xl text-left text-sm font-medium tracking-tight text-gray-600 md:text-sm lg:text-base dark:text-gray-300">
        {BRAND.name}&apos;dan foydalanish uchun email va parol bilan
        ro&apos;yxatdan o&apos;ting.
      </h2>

      <form className="mt-6 flex flex-col gap-8" onSubmit={handleSubmit}>
        <AuthField
          id="register-name"
          label="To'liq ism"
          value={fullName}
          onChange={setFullName}
          placeholder="Ismingiz"
          required
          autoComplete="name"
        />
        <AuthField
          id="register-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="youremail@yourdomain.com"
          required
          autoComplete="email"
        />
        <AuthField
          id="register-password"
          label="Parol"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Create a password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <AuthField
          id="register-confirm"
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
          disabled={loading || googleLoading}
          className="block cursor-pointer rounded-xl border-none bg-neutral-800 px-6 py-2 text-center text-sm font-medium text-white transition duration-150 active:scale-[0.98] sm:text-base disabled:opacity-60"
        >
          {loading ? "Yaratilmoqda..." : "Ro'yxatdan o'tish"}
        </button>

        <div className="mt-2 flex items-center">
          <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
          <span className="px-4 text-sm text-gray-500 dark:text-neutral-400">
            yoki
          </span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            type="button"
            className={SOCIAL_BTN_CLASS}
            onClick={handleGoogleSignIn}
            disabled={!googleEnabled || loading || googleLoading}
            aria-label="Google orqali ro'yxatdan o'tish"
          >
            <GoogleSocialIcon />
          </button>
          <button
            type="button"
            className={SOCIAL_BTN_CLASS}
            aria-label="Facebook"
            title="Tez orada"
            onClick={(e) => e.preventDefault()}
          >
            <FacebookSocialIcon />
          </button>
          <button
            type="button"
            className={SOCIAL_BTN_CLASS}
            aria-label="Apple"
            title="Tez orada"
            onClick={(e) => e.preventDefault()}
          >
            <AppleSocialIcon />
          </button>
        </div>
      </form>

      <div className="mt-6 text-center">
        <span className="text-sm text-gray-600">
          Allaqachon hisobingiz bormi?{" "}
        </span>
        <Link
          href="/login"
          className="text-sm font-medium text-orange-500 hover:underline"
        >
          Kirish
        </Link>
      </div>
    </AuthGradientShell>
  );
}
