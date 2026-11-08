// Preferencias de ROCAS en localStorage (prefijo av_rocas_).
// Todo acceso va en try/catch, igual que lib/session.ts: si el almacenamiento
// está bloqueado el juego sigue funcionando y solo deja de persistir.

import { DEFAULT_SKIN, isSkinName, type SkinName } from "./skins";

export const SKIN_KEY = "av_rocas_skin"; // SkinName

export type RocasPrefs = { skin: SkinName };

export const DEFAULT_PREFS: RocasPrefs = { skin: DEFAULT_SKIN };

const KEYS: Record<keyof RocasPrefs, string> = { skin: SKIN_KEY };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Valores inválidos o ausentes → por defecto.
export function readPrefs(): RocasPrefs {
  const skin = read(SKIN_KEY);
  return { skin: isSkinName(skin) ? skin : DEFAULT_PREFS.skin };
}

export function writePref<K extends keyof RocasPrefs>(
  key: K,
  value: RocasPrefs[K],
): void {
  try {
    localStorage.setItem(KEYS[key], String(value));
  } catch {}
}
