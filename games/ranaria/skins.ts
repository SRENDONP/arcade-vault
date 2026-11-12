// Skins visuales de RANARIA: cada skin define una paleta (los mismos tokens que
// tenía la constante PALETTE de render.ts) y un estilo de forma que render.ts
// aplica en sus helpers. Solo visual: no cambia reglas ni puntuación. Sin
// React ni DOM.

export type SkinName = "clasico" | "neon" | "retro";

export const DEFAULT_SKIN: SkinName = "clasico";

export type RanariaPalette = {
  bg: string; // fondo del campo y fondo de la barra de tiempo
  ink: string; // ojos de la rana
  inkDim: string; // tinta atenuada (reservada)
  inkFaint: string; // rayas de los carriles y listones de los camiones
  cyan: string; // coches de la fila 11 y cabina de la fila 10
  magenta: string; // coches de la fila 12, cabina de la fila 8, rana muerta, tiempo < 25 %
  yellow: string; // coches de la fila 9, borde de los nenúfares, tiempo < 50 %
  green: string; // rana y tiempo ≥ 50 %
  road: string; // carretera
  river: string; // río
  wave: string; // ondas del río (decorativas)
  grass: string; // mediana, salida y orilla
  grassEdge: string; // filo de las franjas de hierba
  lily: string; // relleno de los nenúfares
  log: string; // troncos
  logVein: string; // vetas de los troncos
  turtle: string; // tortugas
  turtleShell: string; // dibujo del caparazón
  truck: string; // caja de los camiones
  wheel: string; // ruedas
};

// solid: formas rellenas, glow solo en la rana y la barra de tiempo (look original).
// outline: contorno opaco con relleno translúcido y glow intenso en todo.
// pixel: la escena se reduce a una rejilla de "píxeles" de `cell` px y se
// cuantiza a la paleta (bordes duros, sin alfa ni glow).
export type SkinStyle = "solid" | "outline" | "pixel";

export type Skin = {
  label: string;
  palette: RanariaPalette;
  style: SkinStyle;
  glow: number; // multiplicador del shadowBlur de la rana y la barra (0 = sin glow)
  entityGlow: number; // shadowBlur de coches, camiones, troncos, tortugas y nenúfares
  fillAlpha: number; // relleno translúcido en el estilo outline
  cell: number; // lado del "píxel" en el estilo pixel
};

export const SKINS: Record<SkinName, Skin> = {
  clasico: {
    label: "Clásico",
    // Tokens de app/globals.css (el canvas no lee variables CSS) + colores de zona.
    palette: {
      bg: "#0a0a0f", // --bg
      ink: "#e6e9ff", // --ink
      inkDim: "#8a8fb5", // --ink-dim
      inkFaint: "#4a4f70", // --ink-faint
      cyan: "#00f5ff", // --cyan
      magenta: "#ff006e", // --magenta
      yellow: "#f5ff00", // --yellow
      green: "#00ff88", // --green
      road: "#0d0d14",
      river: "#061a33",
      wave: "#1b4a7a",
      grass: "#0b2a1a",
      grassEdge: "#14502f",
      lily: "#1fa35c",
      log: "#a86b32",
      logVein: "#6b3f17",
      turtle: "#2fbf71",
      turtleShell: "#14683a",
      truck: "#8a8fb5",
      wheel: "#1a1a24",
    },
    style: "solid",
    glow: 1,
    entityGlow: 0,
    fillAlpha: 1,
    cell: 1,
  },
  neon: {
    label: "Neón",
    palette: {
      bg: "#000000",
      ink: "#ffffff",
      inkDim: "#a0a6e0",
      inkFaint: "#3a3f80",
      cyan: "#00f0ff",
      magenta: "#ff2fd0",
      yellow: "#fff200",
      green: "#39ff14",
      road: "#000000",
      river: "#00102a",
      wave: "#2a6bff",
      grass: "#001a0c",
      grassEdge: "#00b85a",
      lily: "#00e0b0",
      log: "#ff9a1f",
      logVein: "#ff9a1f",
      turtle: "#00c8ff",
      turtleShell: "#00c8ff",
      truck: "#c8ccff",
      wheel: "#3a3f80",
    },
    style: "outline",
    glow: 1.6,
    entityGlow: 10,
    fillAlpha: 0.3,
    cell: 1,
  },
  retro: {
    label: "Retro",
    // Paleta limitada de 10 colores (varios tokens comparten color): tortugas
    // rojas para separarlas de la rana y los troncos; nenúfar = hierba con
    // borde amarillo.
    palette: {
      bg: "#0f0f1b",
      ink: "#f4f4e8",
      inkDim: "#8c8ca8",
      inkFaint: "#4c4c6c",
      cyan: "#5cc8ff",
      magenta: "#e83b3b",
      yellow: "#ffd93a",
      green: "#5ac54f",
      road: "#0f0f1b",
      river: "#1a2466",
      wave: "#4c4c6c",
      grass: "#1c3a24",
      grassEdge: "#5ac54f",
      lily: "#1c3a24",
      log: "#b8742f",
      logVein: "#0f0f1b",
      turtle: "#e83b3b",
      turtleShell: "#0f0f1b",
      truck: "#f4f4e8",
      wheel: "#4c4c6c",
    },
    style: "pixel",
    glow: 0,
    entityGlow: 0,
    fillAlpha: 1,
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
