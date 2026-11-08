// Preferencias de CAÍDA en localStorage (prefijo av_caida_).
// Todo acceso va en try/catch, igual que lib/session.ts: si el almacenamiento
// está bloqueado el juego sigue funcionando y solo deja de persistir.

import { clampStartLevel, MAX_START_LEVEL } from "./core";
import {
  DEFAULT_SKIN,
  isSkinName,
  type CaidaTheme,
  type SkinName,
} from "./skins";

export type { CaidaTheme };

// SkinName. Los valores guardados antes de añadir "clasico" (retro, neon,
// pastel, pixel) siguen siendo válidos; solo quien no tenga ninguno pasa al
// nuevo defecto.
export const SKIN_KEY = "av_caida_skin";
export const THEME_KEY = "av_caida_theme"; // "dark" | "light"
export const START_LEVEL_KEY = "av_caida_start_level"; // "1".."10"

export type CaidaPrefs = {
  skin: SkinName;
  theme: CaidaTheme;
  startLevel: number;
};

export const DEFAULT_PREFS: CaidaPrefs = {
  skin: DEFAULT_SKIN,
  theme: "dark",
  startLevel: 1,
};

const KEYS: Record<keyof CaidaPrefs, string> = {
  skin: SKIN_KEY,
  theme: THEME_KEY,
  startLevel: START_LEVEL_KEY,
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function isTheme(v: unknown): v is CaidaTheme {
  return v === "dark" || v === "light";
}

// Solo acepta los textos "1".."10"; cualquier otro valor usa el defecto.
function parseStartLevel(raw: string | null): number {
  if (raw === null || !/^\d{1,2}$/.test(raw)) return DEFAULT_PREFS.startLevel;
  const n = Number(raw);
  return n >= 1 && n <= MAX_START_LEVEL ? n : DEFAULT_PREFS.startLevel;
}

// Valores inválidos o ausentes → por defecto.
export function readPrefs(): CaidaPrefs {
  const skin = read(SKIN_KEY);
  const theme = read(THEME_KEY);
  return {
    skin: isSkinName(skin) ? skin : DEFAULT_PREFS.skin,
    theme: isTheme(theme) ? theme : DEFAULT_PREFS.theme,
    startLevel: parseStartLevel(read(START_LEVEL_KEY)),
  };
}

export function writePref<K extends keyof CaidaPrefs>(
  key: K,
  value: CaidaPrefs[K],
): void {
  const stored =
    key === "startLevel" ? String(clampStartLevel(value)) : String(value);
  try {
    localStorage.setItem(KEYS[key], stored);
  } catch {}
}
