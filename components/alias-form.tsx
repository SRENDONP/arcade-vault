"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session-provider";
import {
  ALIAS_ERROR_MESSAGES,
  authErrorMessage,
  suggestAlias,
  validateAlias,
} from "@/lib/auth";
import { NAME_MAX } from "@/lib/scores";
import { createClient } from "@/lib/supabase/client";

type AliasFormProps =
  // First alias after signing up: saves and goes on to `next`.
  | { mode: "setup"; next: string }
  // Change it from /cuenta: saves and stays.
  | { mode: "edit" }
  // Inside the game-over modal (SPEC 15): saves, calls refresh() and then
  // onSaved; it never navigates, so the run in progress is kept.
  | { mode: "inline"; onSaved: (alias: string) => void };

// Alias of the player's profile (SPEC 14). The database is the last barrier:
// UNIQUE + CHECK on public.profiles.alias, and only that column is writable.
export function AliasForm(props: AliasFormProps) {
  const router = useRouter();
  const { user, status, refresh } = useSession();
  // null until the player types, so the suggestion (or the current alias)
  // fills in once the session loads after hydration.
  const [input, setInput] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const value = input ?? user?.alias ?? suggestAlias(user?.meta);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || !user) return;
    const result = validateAlias(value);
    if ("error" in result) return setError(ALIAS_ERROR_MESSAGES[result.error]);
    if (result.alias === user.alias) {
      if (props.mode === "setup") router.push(props.next);
      else if (props.mode === "inline") props.onSaved(result.alias);
      else setSaved(true);
      return;
    }

    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const { error: err } = await createClient()
        .from("profiles")
        .update({ alias: result.alias })
        .eq("id", user.id);
      if (err) {
        // 23505 = alias taken; 23514 = CHECK (should not pass validateAlias).
        setError(
          err.code === "23514"
            ? ALIAS_ERROR_MESSAGES.pattern
            : authErrorMessage(err.code),
        );
        return;
      }
      await refresh();
      setInput(null);
      if (props.mode === "setup") {
        router.refresh();
        router.push(props.next);
      } else if (props.mode === "inline") {
        props.onSaved(result.alias);
      } else {
        setSaved(true);
      }
    } catch {
      setError(authErrorMessage(undefined));
    } finally {
      setPending(false);
    }
  };

  if (status !== "signed-in" || !user) {
    return (
      <div className="mono text-center text-[11px] tracking-[0.16em] text-ink-faint">
        CARGANDO PERFIL…
      </div>
    );
  }

  const inline = props.mode === "inline";
  const inputId = inline ? "alias-input-modal" : "alias-input";
  const helpId = inline ? "alias-help-modal" : "alias-help";

  return (
    <form
      onSubmit={submit}
      noValidate
      className={inline ? "alias-inline" : undefined}
    >
      <div className="field">
        <label htmlFor={inputId} className="alias-label">
          <span>Alias</span>
          <span aria-hidden="true">
            {value.length}/{NAME_MAX}
          </span>
        </label>
        <input
          id={inputId}
          className="alias-input"
          autoComplete="nickname"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={NAME_MAX}
          value={value}
          onChange={(e) => {
            setInput(e.target.value.toUpperCase());
            setSaved(false);
          }}
          placeholder="PX_KAI"
          aria-describedby={helpId}
        />
        <div id={helpId} className="alias-help">
          1–{NAME_MAX} CARACTERES · A-Z, 0-9, Ñ, _ . - Y ESPACIO · ES EL NOMBRE
          DEL RANKING
        </div>
      </div>

      {error && (
        <div className="auth-msg error" role="alert">
          ▸ {error}
        </div>
      )}
      {saved && !error && (
        <div className="auth-msg" role="status">
          ▸ ALIAS GUARDADO
        </div>
      )}

      <button
        className={inline ? "btn yellow w-full" : "btn lg mt-2 w-full"}
        type="submit"
        disabled={pending}
      >
        {pending
          ? "GUARDANDO…"
          : props.mode === "setup"
            ? "GUARDAR Y JUGAR"
            : "GUARDAR ALIAS"}
      </button>
    </form>
  );
}
