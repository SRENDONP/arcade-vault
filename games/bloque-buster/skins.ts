// Skins visuales de BLOQUE BUSTER: cada skin define una paleta (los tokens que
// tenían las constantes COLOR y BRICK_COLOR de render.ts, más el destello, el
// texto de la cápsula y el gris dañado) y un estilo de forma que render.ts
// aplica en sus helpers. Solo visual: no cambia reglas ni puntuación.
// Sin React ni DOM.

import type { BrickColor } from "./core";

export type SkinName = "clasico" | "neon" | "retro";

export const DEFAULT_SKIN: SkinName = "clasico";

export type BloqueBusterPalette = {
  bg: string; // fondo del campo
  ink: string; // pelota y núcleo de la pala
  cyan: string; // pala y aviso de nivel superado
  ceiling: string; // línea del techo lógico
  capsule: string; // cápsula multibola
  capsuleInk: string; // texto "+3" sobre la cápsula
  veil: string; // velo del aviso de nivel superado
  flash: string; // destello del gris al primer golpe
  damaged: string; // gris tras el primer golpe
  brick: Record<BrickColor, string>; // color de cada tipo de ladrillo
};

// glass: relleno translúcido, borde brillante y franja de brillo (look original).
// outline: contorno con relleno muy translúcido y glow intenso.
// pixel: formas encajadas en una rejilla de "píxeles", bisel duro, sin glow ni alfa.
export type SkinStyle = "glass" | "outline" | "pixel";

export type Skin = {
  label: string;
  palette: BloqueBusterPalette;
  style: SkinStyle;
  glow: number; // multiplicador de shadowBlur (0 = sin glow)
  fillAlpha: number; // opacidad del relleno de ladrillos y pala (glass/outline)
  cell: number; // lado del "píxel" en el estilo pixel
};

export const SKINS: Record<SkinName, Skin> = {
  clasico: {
    label: "Clásico",
    // Tokens de app/globals.css (el canvas no lee variables CSS). Respecto al
    // look original: techo más opaco, "+3" oscuro, gris dañado opaco, rojo y
    // cápsula separados del magenta.
    palette: {
      bg: "#0a0a0f", // --bg
      ink: "#e6e9ff", // --ink
      cyan: "#00f5ff", // --cyan
      ceiling: "rgba(0, 245, 255, 0.5)",
      capsule: "#ffa000",
      capsuleInk: "#0a0a0f", // --bg
      veil: "rgba(5, 5, 12, 0.55)",
      flash: "#ffffff",
      damaged: "#5f6488",
      brick: {
        gray: "#8a8fb5", // acero (--ink-dim)
        yellow: "#f5ff00", // --yellow
        hotpink: "#ff4fd8",
        magenta: "#ff006e", // --magenta
        red: "#ff2a00",
        green: "#00ff88", // --green
        cyan: "#00f5ff", // --cyan
      },
    },
    style: "glass",
    glow: 1,
    fillAlpha: 0.28,
    cell: 1,
  },
  neon: {
    label: "Neón",
    palette: {
      bg: "#000000",
      ink: "#ffffff",
      cyan: "#00f0ff",
      ceiling: "rgba(0, 240, 255, 0.6)",
      capsule: "#ffaa00",
      capsuleInk: "#000000",
      veil: "rgba(0, 0, 0, 0.6)",
      flash: "#ffffff",
      damaged: "#7a80c8",
      brick: {
        gray: "#c0c6ff",
        yellow: "#fff200",
        hotpink: "#ff6bff",
        magenta: "#ff0090",
        red: "#ff3a00",
        green: "#39ff14",
        cyan: "#00f0ff",
      },
    },
    style: "outline",
    glow: 2,
    fillAlpha: 0.18,
    cell: 1,
  },
  retro: {
    label: "Retro",
    // Paleta limitada propia (los 7 tipos de ladrillo obligan a pasar de 8
    // tonos); destello = tinta, texto de la cápsula = fondo, y el cian de la
    // pala es el del ladrillo cian.
    palette: {
      bg: "#10101c",
      ink: "#f4f4e8",
      cyan: "#4fc3f7",
      ceiling: "#5a6a9c",
      capsule: "#ff9c2a",
      capsuleInk: "#10101c",
      veil: "rgba(16, 16, 28, 0.6)",
      flash: "#f4f4e8",
      damaged: "#6c6c84",
      brick: {
        gray: "#a8a8bc",
        yellow: "#ffd93a",
        hotpink: "#ff8ad8",
        magenta: "#b05cff",
        red: "#e83b3b",
        green: "#5ac54f",
        cyan: "#4fc3f7",
      },
    },
    style: "pixel",
    glow: 0,
    fillAlpha: 1,
    cell: 3,
  },
};

export function isSkinName(v: unknown): v is SkinName {
  return (
    typeof v === "string" && Object.prototype.hasOwnProperty.call(SKINS, v)
  );
}

export function getSkin(name: unknown): Skin {
  return isSkinName(name) ? SKINS[name] : SKINS[DEFAULT_SKIN];
}

// Aclara (amount > 0) u oscurece (amount < 0) un color #rrggbb (copia de
// games/caida/skins.ts; no se importa entre juegos).
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (v: number) => Math.round(v + (target - v) * t);
  const r = mix(n >> 16);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
