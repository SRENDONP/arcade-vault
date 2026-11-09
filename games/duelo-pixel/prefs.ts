// Preferencias de DUELO PIXEL en localStorage (prefijo av_duelo-pixel_).
// Todo acceso va en try/catch, igual que games/caida/prefs.ts: si el
// almacenamiento está bloqueado el juego sigue funcionando y solo deja de
// persistir. Solo se llama desde snapshots de cliente o manejadores (nunca en
// el render del servidor), para no provocar desajustes de hidratación.

import { DEFAULT_SKIN, isSkinName, type SkinName } from "./skins";

export const SKIN_KEY = "av_duelo-pixel_skin"; // SkinName

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
