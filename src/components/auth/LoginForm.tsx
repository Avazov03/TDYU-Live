"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "Bu email boshqa usul bilan ro'yxatdan o'tgan. Email va parol bilan kiring.",
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
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const oauthError = searchParams.get("error");
  const displayError =
    error ??
    (oauthError
      ? (AUTH_ERROR_MESSAGES[oauthError] ?? AUTH_ERROR_MESSAGES.Default)
      : null);

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
      setError("Login yoki parol noto'g'ri");
      return;
    }
    router.push("/go");
    router.refresh();
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
        Xush kelibsiz!
      </h1>
      <h2 className="mt-4 max-w-xl text-left text-sm font-medium tracking-tight text-gray-600 md:text-sm lg:text-base dark:text-gray-300">
        {BRAND.name} — jonli dars va kurslar. Hisobingizga kiring va o&apos;qishni
        davom ettiring.
      </h2>

      <form className="mt-6 flex flex-col gap-8" onSubmit={handleSubmit}>
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="youremail@yourdomain.com"
          required
          autoComplete="email"
        />
        <AuthField
          id="login-password"
          label="Parol"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Create a password"
          required
          autoComplete="current-password"
        />

        {displayError && (
          <div className="text-sm text-red-500" role="alert">
            {displayError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="block cursor-pointer rounded-xl border-none bg-neutral-800 px-6 py-2 text-center text-sm font-medium text-white transition duration-150 active:scale-[0.98] sm:text-base disabled:opacity-60"
        >
          {loading ? "Kirilmoqda..." : "Kirish"}
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
            aria-label="Google orqali kirish"
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
        <span className="text-sm text-gray-600">Hisobingiz yo&apos;qmi? </span>
        <Link
          href="/register"
          className="text-sm font-medium text-orange-500 hover:underline"
        >
          Ro&apos;yxatdan o&apos;tish
        </Link>
      </div>
    </AuthGradientShell>
  );
}
