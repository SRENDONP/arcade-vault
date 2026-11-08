// Skins visuales de SERPENTINA: cada skin define una paleta (los mismos tokens
// que tenía la constante COLOR de render.ts, más el brillo de la comida) y un
// estilo de forma que render.ts aplica en sus helpers. Solo visual: no cambia
// reglas ni puntuación. Sin React ni DOM.

export type SkinName = "clasico" | "neon" | "retro";

export const DEFAULT_SKIN: SkinName = "clasico";

export type SerpentinaPalette = {
  bg: string; // fondo del campo
  ink: string; // texto del aviso de espera
  faint: string; // rejilla de puntos (decorativa)
  wall: string; // muros
  snake: string; // cuerpo de la serpiente
  head: string; // cabeza
  food: string; // comida y marca del choque
  foodShine: string; // brillo de la comida (decorativo)
  bonus: string; // bonus y su anillo de tiempo
};

// solid: bloques redondeados rellenos, glow en cabeza, núcleos y muros (look original).
// outline: contorno con relleno translúcido y glow intenso.
// pixel: formas encajadas en una rejilla de "píxeles", sin glow ni alfa.
export type SkinStyle = "solid" | "outline" | "pixel";

export type Skin = {
  label: string;
  palette: SerpentinaPalette;
  style: SkinStyle;
  glow: number; // multiplicador de shadowBlur (0 = sin glow)
  fillAlpha: number; // relleno translúcido en el estilo outline
  tailAlpha: number; // opacidad mínima de la cola (1 = sin atenuar)
  bodyGlow: number; // shadowBlur del cuerpo (0 = solo la cabeza brilla)
  cell: number; // lado del "píxel" en el estilo pixel
};

export const SKINS: Record<SkinName, Skin> = {
  clasico: {
    label: "Clásico",
    // Tokens de app/globals.css (el canvas no lee variables CSS).
    palette: {
      bg: "#0a0a0f", // --bg
      ink: "#e6e9ff", // --ink
      faint: "#4a4f70", // --ink-faint
      wall: "#00f5ff", // --cyan
      snake: "#00ff88", // --green (color del catálogo)
      head: "#8affc6", // --green aclarado
      food: "#ff006e", // --magenta
      foodShine: "#ffd0e4",
      bonus: "#f5ff00", // --yellow
    },
    style: "solid",
    glow: 1,
    fillAlpha: 1,
    tailAlpha: 0.45,
    bodyGlow: 0,
    cell: 1,
  },
  neon: {
    label: "Neón",
    palette: {
      bg: "#000000",
      ink: "#ffffff",
      faint: "#2e3366",
      wall: "#00f0ff",
      snake: "#39ff14",
      head: "#c4ffb0",
      food: "#ff2fd0",
      foodShine: "#ffd6f5",
      bonus: "#fff200",
    },
    style: "outline",
    glow: 2,
    fillAlpha: 0.3,
    tailAlpha: 0.45,
    bodyGlow: 10,
    cell: 1,
  },
  retro: {
    label: "Retro",
    // Paleta limitada de 8 colores; el brillo de la comida reutiliza la tinta.
    palette: {
      bg: "#10101c",
      ink: "#f4f4e8",
      faint: "#3c3c5c",
      wall: "#6b8cff",
      snake: "#5ac54f",
      head: "#a8e65a",
      food: "#e83b3b",
      foodShine: "#f4f4e8",
      bonus: "#ffd93a",
    },
    style: "pixel",
    glow: 0,
    fillAlpha: 1,
    tailAlpha: 1,
    bodyGlow: 0,
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
