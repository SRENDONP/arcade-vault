// Preferencias de RANARIA en localStorage (prefijo av_ranaria_).
// Todo acceso va en try/catch, igual que lib/session.ts: si el almacenamiento
// está bloqueado el juego sigue funcionando y solo deja de persistir.

import { DEFAULT_SKIN, isSkinName, type SkinName } from "./skins";

export const SKIN_KEY = "av_ranaria_skin"; // SkinName

export type RanariaPrefs = { skin: SkinName };

export const DEFAULT_PREFS: RanariaPrefs = { skin: DEFAULT_SKIN };

const KEYS: Record<keyof RanariaPrefs, string> = { skin: SKIN_KEY };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Valores inválidos o ausentes → por defecto.
export function readPrefs(): RanariaPrefs {
  const skin = read(SKIN_KEY);
  return { skin: isSkinName(skin) ? skin : DEFAULT_PREFS.skin };
}

export function writePref<K extends keyof RanariaPrefs>(
  key: K,
  value: RanariaPrefs[K],
): void {
  try {
    localStorage.setItem(KEYS[key], String(value));
  } catch {}
}
