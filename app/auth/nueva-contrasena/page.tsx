import { AuthNewPasswordForm } from "@/components/auth-new-password-form";

// Reached from the recovery link through /auth/callback; without a session
// the proxy sends the visitor to /auth/recuperar.
export default function NewPasswordPage() {
  return <AuthNewPasswordForm />;
}
