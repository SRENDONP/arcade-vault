// Preferencia de BLOQUE BUSTER en localStorage (prefijo av_bloque-buster_).
// Todo acceso va en try/catch, igual que games/caida/prefs.ts: si el
// almacenamiento está bloqueado el juego suena y solo deja de persistir.
// Solo se llama desde efectos o manejadores (nunca en el render), para no
// provocar desajustes de hidratación.

export const MUTED_KEY = "av_bloque-buster_muted"; // "1" | "0"

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
