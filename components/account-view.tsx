"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AliasForm } from "@/components/alias-form";
import { useSession } from "@/components/session-provider";
import { aliasPath, AUTH_ROUTES } from "@/lib/auth";

const PROVIDER_LABELS: Record<string, string> = {
  email: "EMAIL",
  google: "GOOGLE",
  github: "GITHUB",
};

// /cuenta (SPEC 14): the player card. The alias is the one loud element; the
// rest (email, linked sign-in methods, edit, sign out) stays quiet.
export function AccountView() {
  const router = useRouter();
  const { user, status, logout } = useSession();
  const [leaving, setLeaving] = useState(false);

  const signOut = async () => {
    if (leaving) return;
    setLeaving(true);
    await logout();
    router.push("/");
  };

  if (status !== "signed-in" || !user) {
    return (
      <div className="auth-card mono text-center text-[11px] tracking-[0.16em] text-ink-faint">
        CARGANDO CUENTA…
      </div>
    );
  }

  return (
    <div className="auth-card account-card">
      <div className="account-hero">
        <div className={"account-alias" + (user.alias ? "" : " empty")}>
          {user.alias ?? "???"}
        </div>
        <div className="account-caption">
          {user.alias
            ? "Tu nombre en el Salón de la Fama"
            : "Aún no tienes alias"}
        </div>
      </div>

      <dl className="account-facts">
        <div>
          <dt>Correo</dt>
          <dd className="account-email">{user.email ?? "—"}</dd>
        </div>
        <div>
          <dt>Accedes con</dt>
          <dd className="account-providers">
            {user.providers.length === 0
              ? "—"
              : user.providers.map((p) => (
                  <span key={p} className="account-provider">
                    {PROVIDER_LABELS[p] ?? p.toUpperCase()}
                  </span>
                ))}
          </dd>
        </div>
      </dl>

      {user.alias ? (
        <section
          className="account-section"
          aria-labelledby="account-alias-title"
        >
          <h3 id="account-alias-title" className="account-section-title">
            Cambiar alias
          </h3>
          <AliasForm mode="edit" />
        </section>
      ) : (
        <Link
          href={aliasPath(AUTH_ROUTES.account)}
          className="btn yellow lg mt-2 w-full justify-center"
        >
          ELEGIR ALIAS
        </Link>
      )}

      <button
        type="button"
        className="btn magenta mt-4 w-full justify-center"
        onClick={signOut}
        disabled={leaving}
      >
        {leaving ? "CERRANDO…" : "CERRAR SESIÓN"}
      </button>
    </div>
  );
}
