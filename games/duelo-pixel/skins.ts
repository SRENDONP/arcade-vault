// Skins visuales de DUELO PIXEL (§7 de integracion.md). Cada skin define la
// paleta de todos los elementos del campo y un estilo de forma que render.ts
// aplica. Solo visual: no cambia reglas ni puntuación. Sin React ni DOM.

export type SkinName = "clasico" | "neon" | "retro";

export const DEFAULT_SKIN: SkinName = "clasico";

export type DueloPixelPalette = {
  bg: string; // fondo del campo
  barrier: string; // barrera central (decorativa)
  pulse: string; // pulsos que recorren la barrera (decorativos)
  player: string; // paleta del jugador
  cpu: string; // paleta del rival
  ball: string; // pelota
  plasma: string; // pelota con plasma y su estela
  meterOff: string; // segmento vacío del medidor (contorno)
  meterOn: string; // segmento cargado
  accent: string; // título de los avisos
  text: string; // subtítulo de los avisos
  veil: string; // velo del aviso entre sets
};

// soft: relleno con glow suave (aspecto de la plataforma).
// outline: contorno, relleno translúcido y glow intenso.
// pixel: formas duras sin glow, alfa ni antialiasing.
export type SkinStyle = "soft" | "outline" | "pixel";

export type Skin = {
  label: string;
  palette: DueloPixelPalette;
  style: SkinStyle;
  glow: number; // multiplicador de shadowBlur (0 = sin glow)
};

export const SKINS: Record<SkinName, Skin> = {
  clasico: {
    label: "Clásico",
    // Tokens de app/globals.css (el canvas no lee variables CSS).
    palette: {
      bg: "#0a0a0f", // --bg
      barrier: "rgba(0, 245, 255, 0.18)",
      pulse: "rgba(0, 245, 255, 0.55)",
      player: "#00f5ff", // --cyan
      cpu: "#ff2bd6",
      ball: "#ffffff",
      plasma: "#f5ff00", // --yellow
      meterOff: "#6b7099",
      meterOn: "#00f5ff",
      accent: "#00f5ff",
      text: "#e6e9ff", // --ink
      veil: "rgba(5, 5, 12, 0.6)",
    },
    style: "soft",
    glow: 1,
  },
  neon: {
    label: "Neón",
    palette: {
      bg: "#000000",
      barrier: "rgba(0, 240, 255, 0.22)",
      pulse: "rgba(0, 240, 255, 0.8)",
      player: "#00f0ff",
      cpu: "#ff3df0",
      ball: "#ffffff",
      plasma: "#fff200",
      meterOff: "#7a80c8",
      meterOn: "#00f0ff",
      accent: "#00f0ff",
      text: "#ffffff",
      veil: "rgba(0, 0, 0, 0.65)",
    },
    style: "outline",
    glow: 2,
  },
  retro: {
    label: "Retro",
    // Paleta limitada de 8 bits: fondo, tinta, azul, rojo, ámbar y dos grises.
    palette: {
      bg: "#10101c",
      barrier: "#2a2a44",
      pulse: "#4a4a70",
      player: "#4fc3f7",
      cpu: "#e83b3b",
      ball: "#f4f4e8",
      plasma: "#ffd93a",
      meterOff: "#7a7a96",
      meterOn: "#4fc3f7",
      accent: "#ffd93a",
      text: "#f4f4e8",
      veil: "rgba(16, 16, 28, 0.7)",
    },
    style: "pixel",
    glow: 0,
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
