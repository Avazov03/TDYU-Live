import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { isGoogleAuthEnabled } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm googleEnabled={isGoogleAuthEnabled} />
    </Suspense>
  );
}
