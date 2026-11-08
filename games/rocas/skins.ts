// Skins visuales de ROCAS: cada skin define una paleta (los mismos tokens que
// tenía la constante COLOR de render.ts) y un estilo de trazo que render.ts
// aplica en sus helpers. Solo visual: no cambia reglas ni puntuación.
// Sin React ni DOM.

export type SkinName = "clasico" | "neon" | "retro";

export const DEFAULT_SKIN: SkinName = "clasico";

export type RocasPalette = {
  bg: string; // fondo del campo
  ship: string; // nave
  rock: string; // asteroides
  powerUp: string; // power-up de disparo triple y su contador (texto)
  bullet: string; // balas
  flame: string; // llama del propulsor
  particle: string; // chispas de las explosiones (#rrggbb, el alfa lo pone render)
};

// vector: trazo con glow (look original).
// outline: contorno con relleno translúcido y glow intenso.
// pixel: trazos encajados en una rejilla de "píxeles", sin glow ni alfa.
export type SkinStyle = "vector" | "outline" | "pixel";

export type Skin = {
  label: string;
  palette: RocasPalette;
  style: SkinStyle;
  glow: number; // multiplicador de shadowBlur (0 = sin glow)
  fillAlpha: number; // relleno translúcido de las formas cerradas (0 = sin relleno)
  cell: number; // lado del "píxel" en el estilo pixel
};

export const SKINS: Record<SkinName, Skin> = {
  clasico: {
    label: "Clásico",
    // Tokens de app/globals.css (el canvas no lee variables CSS).
    palette: {
      bg: "#0a0a0f", // --bg
      ship: "#00f5ff", // --cyan
      rock: "#f5ff00", // --yellow (color del catálogo)
      powerUp: "#ff006e", // --magenta
      bullet: "#ffffff",
      flame: "rgba(255, 130, 0, 0.9)",
      particle: "#ffffff",
    },
    style: "vector",
    glow: 1,
    fillAlpha: 0,
    cell: 1,
  },
  neon: {
    label: "Neón",
    palette: {
      bg: "#000000",
      ship: "#00f0ff",
      rock: "#39ff14",
      powerUp: "#ff2fd0",
      bullet: "#ffffff",
      flame: "rgba(255, 122, 0, 0.9)",
      particle: "#b8fbff",
    },
    style: "outline",
    glow: 2.2,
    fillAlpha: 0.14,
    cell: 1,
  },
  retro: {
    label: "Retro",
    // Paleta limitada de 6 colores.
    palette: {
      bg: "#0f0f1b",
      ship: "#5fcde4",
      rock: "#d9a066",
      powerUp: "#ff5a8a",
      bullet: "#ffffff",
      flame: "#fbf236",
      particle: "#ffffff",
    },
    style: "pixel",
    glow: 0,
    fillAlpha: 0,
    cell: 4,
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
