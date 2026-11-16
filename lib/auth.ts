// Auth rules shared by the proxy, the callback and the auth screens (SPEC 14).
// The alias follows the leaderboard name rules of lib/scores.ts and the CHECK
// on public.profiles.alias (supabase/migrations/20261115190741_profiles.sql).
// Pure: no React, no Supabase, no window.

import {
  DEFAULT_NAME,
  NAME_MAX,
  NAME_PATTERN,
  normalizeName,
} from "@/lib/scores";

export const PASSWORD_MIN = 8;

export const AUTH_ROUTES = {
  signIn: "/auth",
  callback: "/auth/callback",
  recover: "/auth/recuperar",
  newPassword: "/auth/nueva-contrasena",
  alias: "/auth/alias",
  account: "/cuenta",
} as const;

// Routes that need a session; without one the proxy sends them to /auth?next=.
export const PROTECTED_PATHS = [
  AUTH_ROUTES.account,
  AUTH_ROUTES.alias,
] as const;

const DEFAULT_NEXT = "/biblioteca";

export type AliasError = "empty" | "pattern" | "reserved";

export function validateAlias(
  raw: string,
): { alias: string } | { error: AliasError } {
  const alias = normalizeName(typeof raw === "string" ? raw : "");
  if (!alias) return { error: "empty" };
  if (alias === DEFAULT_NAME) return { error: "reserved" };
  if (!NAME_PATTERN.test(alias)) return { error: "pattern" };
  return { alias };
}

export const ALIAS_ERROR_MESSAGES: Record<AliasError, string> = {
  empty: "ALIAS VACÍO",
  pattern: "SOLO A-Z, 0-9, Ñ, _ . - Y ESPACIO",
  reserved: "ESE ALIAS ESTÁ RESERVADO",
};

// Turns any text into something that passes NAME_PATTERN: uppercase, accents
// removed (Ñ is kept), invalid characters dropped, spaces collapsed, cut to
// NAME_MAX. "" when nothing valid is left.
function toAlias(raw: string): string {
  const upper = raw.toUpperCase().replace(/Ñ/g, "\u0000");
  const plain = upper
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0000/g, "Ñ");
  const cleaned = plain
    .replace(/[^A-Z0-9Ñ_ .-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return cleaned === DEFAULT_NAME ? "" : cleaned;
}

// Alias suggested from the provider metadata (GitHub: user_name, preferred_username;
// Google: full_name, name). The first key that yields a valid alias wins.
export function suggestAlias(
  meta: Record<string, unknown> | undefined,
): string {
  if (!meta) return "";
  for (const key of ["user_name", "preferred_username", "full_name", "name"]) {
    const value = meta[key];
    if (typeof value !== "string") continue;
    const alias = toAlias(value);
    if (alias) return alias;
  }
  return "";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(raw: string): string | null {
  const email = (typeof raw === "string" ? raw : "").trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function validatePassword(raw: string): boolean {
  return typeof raw === "string" && raw.length >= PASSWORD_MIN;
}

// Only internal paths: they start with "/" and not with "//" or "/\" (which
// browsers read as another host). Anything else falls back.
export function safeNext(
  raw: string | null | undefined,
  fallback: string = DEFAULT_NEXT,
): string {
  if (typeof raw !== "string" || raw === "") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\"))
    return fallback;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}

// Where to send a signed-in player who has no alias yet. If `next` already is
// the alias screen it is kept as is, so the chain never nests
// (/auth/alias?next=/auth/alias?next=…).
export function aliasPath(next: string): string {
  const path = next.split(/[?#]/, 1)[0];
  if (path === AUTH_ROUTES.alias) return next;
  return `${AUTH_ROUTES.alias}?next=${encodeURIComponent(next)}`;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "EMAIL O CONTRASEÑA INCORRECTOS",
  email_not_confirmed: "CONFIRMA TU CORREO ANTES DE ENTRAR",
  weak_password: "CONTRASEÑA DEMASIADO DÉBIL",
  over_email_send_rate_limit: "DEMASIADOS CORREOS · PRUEBA MÁS TARDE",
  same_password: "LA CONTRASEÑA ES IGUAL A LA ANTERIOR",
  "23505": "ESE ALIAS YA ESTÁ EN USO",
  callback: "NO SE PUDO COMPLETAR EL ACCESO",
};

export function authErrorMessage(code: string | undefined): string {
  return (
    (code && AUTH_ERROR_MESSAGES[code]) || "ALGO FALLÓ · INTÉNTALO DE NUEVO"
  );
}
