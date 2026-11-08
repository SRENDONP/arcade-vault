// Preferencias de BLOQUE BUSTER en localStorage (prefijo av_bloque-buster_).
// Todo acceso va en try/catch, igual que games/caida/prefs.ts: si el
// almacenamiento está bloqueado el juego sigue funcionando y solo deja de
// persistir. Solo se llama desde efectos, snapshots de cliente o manejadores
// (nunca en el render del servidor), para no provocar desajustes de hidratación.

import { DEFAULT_SKIN, isSkinName, type SkinName } from "./skins";

export const MUTED_KEY = "av_bloque-buster_muted"; // "1" | "0"
export const SKIN_KEY = "av_bloque-buster_skin"; // SkinName

// Ausente, inválido o inaccesible → con sonido (false).
export function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // sin persistencia; el juego sigue funcionando
  }
}

// Ausente, inválido o inaccesible → skin por defecto.
export function readSkin(): SkinName {
  try {
    const v = localStorage.getItem(SKIN_KEY);
    return isSkinName(v) ? v : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function writeSkin(skin: SkinName): void {
  try {
    localStorage.setItem(SKIN_KEY, skin);
  } catch {
    // sin persistencia; el juego sigue funcionando
  }
}
