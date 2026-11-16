"use client";

import Link from "next/link";
import { useState } from "react";
import { authErrorMessage, PASSWORD_MIN, validatePassword } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

// New password after the recovery link (SPEC 14). The proxy only lets a
// signed-in player in, so updateUser applies to the recovery session.
export function AuthNewPasswordForm() {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!validatePassword(pass))
      return setError(`LA CONTRASEÑA NECESITA ${PASSWORD_MIN} CARACTERES`);
    if (pass !== pass2) return setError("LAS CONTRASEÑAS NO COINCIDEN");

    setError(null);
    setPending(true);
    try {
      const { error: err } = await createClient().auth.updateUser({
        password: pass,
      });
      if (err) {
        setError(authErrorMessage(err.code));
        return;
      }
      setDone(true);
      setPass("");
      setPass2("");
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
          <h2 className="neon-cyan">NUEVA CONTRASEÑA</h2>
        </div>

        {done ? (
          <>
            <p className="auth-note" role="status">
              CONTRASEÑA ACTUALIZADA. YA PUEDES ENTRAR CON ELLA.
            </p>
            <Link href="/biblioteca" className="btn lg mt-4 w-full">
              IR A LA BIBLIOTECA
            </Link>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="new-pass">Contraseña nueva</label>
              <input
                id="new-pass"
                type="password"
                autoComplete="new-password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="field">
              <label htmlFor="new-pass2">Repite la contraseña</label>
              <input
                id="new-pass2"
                type="password"
                autoComplete="new-password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                placeholder="••••••••"
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
              {pending ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
