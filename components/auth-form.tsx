"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session-provider";
import {
  aliasPath,
  AUTH_ROUTES,
  authErrorMessage,
  PASSWORD_MIN,
  safeNext,
  validateEmail,
  validatePassword,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type Tab = "in" | "up";
type Provider = "google" | "github";
// What is in flight: one submit or one provider redirect at a time.
type Pending = "submit" | Provider | null;

const callbackUrl = (next: string) =>
  `${window.location.origin}${AUTH_ROUTES.callback}?next=${encodeURIComponent(next)}`;

// Sign in / sign up with Supabase Auth (SPEC 14): email + password, Google and
// GitHub. Everything runs with the browser client, so the session store
// (components/session-provider.tsx) hears about it through onAuthStateChange.
export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { logout } = useSession();

  const [tab, setTab] = useState<Tab>("in");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(
    params.get("error")
      ? authErrorMessage(params.get("error") ?? undefined)
      : null,
  );
  // Email the confirmation link was sent to; shows "REVISA TU CORREO".
  const [sentTo, setSentTo] = useState<string | null>(null);

  const busy = pending !== null;

  const switchTab = (t: Tab) => {
    setTab(t);
    setError(null);
    setPass2("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleanEmail = validateEmail(email);
    if (!cleanEmail) return setError("EMAIL NO VÁLIDO");
    if (!validatePassword(pass))
      return setError(`LA CONTRASEÑA NECESITA ${PASSWORD_MIN} CARACTERES`);
    if (tab === "up" && pass !== pass2)
      return setError("LAS CONTRASEÑAS NO COINCIDEN");

    setError(null);
    setPending("submit");
    const supabase = createClient();
    try {
      if (tab === "in") {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: pass,
        });
        if (err || !data.user) {
          setError(authErrorMessage(err?.code));
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("alias")
          .eq("id", data.user.id)
          .maybeSingle();
        // The proxy and Server Components must see the new session cookies.
        router.refresh();
        router.push(profile?.alias ? next : aliasPath(next));
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password: pass,
          options: { emailRedirectTo: callbackUrl(next) },
        });
        if (err) {
          setError(authErrorMessage(err.code));
          return;
        }
        // Also shown when the email already has an account: Supabase does not
        // reveal it, and neither do we.
        setSentTo(cleanEmail);
        setPass("");
        setPass2("");
      }
    } catch {
      setError(authErrorMessage(undefined));
    } finally {
      setPending(null);
    }
  };

  const oauth = async (provider: Provider) => {
    if (busy) return;
    setError(null);
    setPending(provider);
    try {
      const { error: err } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl(next) },
      });
      // On success the browser is already leaving for the provider.
      if (err) {
        setError(authErrorMessage(err.code));
        setPending(null);
      }
    } catch {
      setError(authErrorMessage(undefined));
      setPending(null);
    }
  };

  const playAsGuest = async () => {
    await logout();
    router.push("/biblioteca");
  };

  if (sentTo) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark"></div>
            <h2 className="neon-cyan">REVISA TU CORREO</h2>
          </div>
          <p className="auth-note" role="status">
            TE ENVIAMOS UN ENLACE A{" "}
            <strong className="text-cyan">{sentTo}</strong>. ÁBRELO EN ESTE
            NAVEGADOR PARA ACTIVAR TU CUENTA.
          </p>
          <button
            className="btn lg mt-4 w-full"
            type="button"
            onClick={() => {
              setSentTo(null);
              setTab("in");
            }}
          >
            VOLVER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "in"}
            className={tab === "in" ? "on" : ""}
            onClick={() => switchTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "up"}
            className={tab === "up" ? "on" : ""}
            onClick={() => switchTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              autoComplete={tab === "in" ? "current-password" : "new-password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="auth-pass2">Repite la contraseña</label>
              <input
                id="auth-pass2"
                type="password"
                autoComplete="new-password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {tab === "in" && (
            <div className="auth-aside">
              <Link href={AUTH_ROUTES.recover} className="auth-link">
                ¿OLVIDASTE TU CONTRASEÑA?
              </Link>
            </div>
          )}

          {error && (
            <div className="auth-msg error" role="alert">
              ▸ {error}
            </div>
          )}

          <button className="btn lg mt-2 w-full" type="submit" disabled={busy}>
            {pending === "submit"
              ? tab === "in"
                ? "ENTRANDO…"
                : "CREANDO…"
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR CUENTA"}
          </button>
        </form>

        <button
          className="btn ghost mt-2.5 w-full"
          type="button"
          onClick={playAsGuest}
          disabled={busy}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => oauth("google")}
            disabled={busy}
          >
            {pending === "google" ? "CONECTANDO…" : "◆ GOOGLE"}
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => oauth("github")}
            disabled={busy}
          >
            {pending === "github" ? "CONECTANDO…" : "▣ GITHUB"}
          </button>
        </div>

        <div className="mt-[18px] text-center text-[11px] tracking-[0.1em] text-ink-faint">
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
