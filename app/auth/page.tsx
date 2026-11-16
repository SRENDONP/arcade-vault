import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

// AuthForm reads ?next= and ?error= with useSearchParams, which only exists at
// request time: with Cache Components it must sit inside <Suspense>.
export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="av-auth-wrap">
          <div className="auth-card mono text-center text-[11px] tracking-[0.16em] text-ink-faint">
            CARGANDO ACCESO…
          </div>
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
