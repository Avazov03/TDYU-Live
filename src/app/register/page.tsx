import { RegisterForm } from "@/components/auth/RegisterForm";
import { isGoogleAuthEnabled } from "@/lib/auth";

export default function RegisterPage() {
  return <RegisterForm googleEnabled={isGoogleAuthEnabled} />;
}
