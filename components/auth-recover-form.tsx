"use client";

import Link from "next/link";
import { useState } from "react";
import { AUTH_ROUTES, authErrorMessage, validateEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

// "Forgot your password?" (SPEC 14): sends the recovery link. The link comes
// back through /auth/callback, which opens /auth/nueva-contrasena signed in.
export function AuthRecoverForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const cleanEmail = validateEmail(email);
    if (!cleanEmail) return setError("EMAIL NO VÁLIDO");

    setError(null);
    setPending(true);
    try {
      const next = encodeURIComponent(AUTH_ROUTES.newPassword);
      const { error: err } = await createClient().auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: `${window.location.origin}${AUTH_ROUTES.callback}?next=${next}`,
        },
      );
      // Only the rate limit is reported: any other answer must not reveal
      // whether the email has an account.
      if (err?.code === "over_email_send_rate_limit") {
        setError(authErrorMessage(err.code));
        return;
      }
      if (err) console.error("[auth] recover:", err.code);
      setSent(true);
    } catch {
      setError(authErrorMessage(undefined));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">RECUPERAR ACCESO</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
            TE ENVIAMOS UN ENLACE PARA ELEGIR UNA CONTRASEÑA NUEVA
          </div>
        </div>

        {sent ? (
          <>
            <p className="auth-note" role="status">
              SI EXISTE UNA CUENTA, TE LLEGARÁ UN ENLACE. ÁBRELO EN ESTE
              NAVEGADOR.
            </p>
            <Link href={AUTH_ROUTES.signIn} className="btn lg mt-4 w-full">
              VOLVER AL ACCESO
            </Link>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="recover-email">Correo electrónico</label>
              <input
                id="recover-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
              />
            </div>

            {error && (
              <div className="auth-msg error" role="alert">
                ▸ {error}
              </div>
            )}

            <button
              className="btn lg mt-2 w-full"
              type="submit"
              disabled={pending}
            >
              {pending ? "ENVIANDO…" : "ENVIAR ENLACE"}
            </button>
            <Link href={AUTH_ROUTES.signIn} className="btn ghost mt-2.5 w-full">
              VOLVER AL ACCESO
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
