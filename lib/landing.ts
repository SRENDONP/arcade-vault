// Landing and About mock data, ported from references/home-about/home.jsx and about.jsx.

import type { GameColor } from "@/lib/games";

export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";
export type Feature = { icon: FeatureIconKind; title: string; desc: string; color: GameColor };

export type HomeStat = { n: string; u: string; s: string };

export type TickerEntry = { player: string; game: string; score: number; ago: string; color: GameColor };
export type TopPlayer = { rank: number; player: string; score: number };

export type Faq = { q: string; a: string };

export type HighlightIconKind = "HEART" | "BROWSER" | "PLANT";
export type Highlight = { icon: HighlightIconKind; text: string; color: GameColor };

export const FEATURES: Feature[] = [
  { icon: "GAMEPAD", title: "JUEGOS CLÁSICOS", desc: "Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.", color: "cyan" },
  { icon: "FREE", title: "100% GRATIS", desc: "Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.", color: "yellow" },
  { icon: "TROPHY", title: "LADDER BOARDS", desc: "Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.", color: "magenta" },
  { icon: "ROCKET", title: "SIEMPRE CRECIENDO", desc: "Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.", color: "green" },
];

export const HOME_STATS: HomeStat[] = [
  { n: "12+", u: "JUEGOS", s: "Y CONTANDO" },
  { n: "MILES", u: "DE PARTIDAS", s: "JUGADAS CADA DÍA" },
  { n: "GLOBAL", u: "RANKING", s: "COMPITE CON EL MUNDO" },
];

export const TICKER: TickerEntry[] = [
  { player: "NEONFOX", game: "Caída", score: 184220, ago: "hace 2 min", color: "magenta" },
  { player: "PX_KAI", game: "Glotón", score: 96400, ago: "hace 5 min", color: "yellow" },
  { player: "Z3R0COOL", game: "Invasores", score: 54190, ago: "hace 8 min", color: "green" },
  { player: "VAULT_07", game: "Rocas", score: 41200, ago: "hace 12 min", color: "cyan" },
  { player: "GLITCHA", game: "Bloque Buster", score: 28450, ago: "hace 18 min", color: "cyan" },
  { player: "ARKADYA", game: "Serpentina", score: 7820, ago: "hace 24 min", color: "green" },
  { player: "CYBER_LU", game: "Ranaria", score: 18900, ago: "hace 31 min", color: "yellow" },
];

export const TOP_PLAYERS: TopPlayer[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];

export const PRICING_PERKS: string[] = [
  "✔ Acceso a todos los juegos",
  "✔ Ranking global y salón de la fama",
  "✔ Sin anuncios entre partidas",
  "✔ Guarda tus puntuaciones",
  "✔ Nuevos juegos cada mes",
  "✔ Funciona en cualquier navegador",
];

export const FAQS: Faq[] = [
  { q: "¿REALMENTE ES GRATIS?", a: "Sí. Arcade Vault es un proyecto sin fines de lucro hecho por amor a los clásicos. No hay versión \"premium\" escondida." },
  { q: "¿NECESITO CREAR CUENTA?", a: "No. Puedes jugar como invitado. Si quieres guardar tu puntuación y aparecer en el ranking, regístrate en 10 segundos." },
  { q: "¿CÓMO SOBREVIVEN SIN COBRAR?", a: "Es un proyecto comunitario. Si te gusta, compártelo. Esa es toda la moneda que aceptamos." },
];

export const HIGHLIGHTS: Highlight[] = [
  { icon: "HEART", text: "HECHO CON ❤️ PARA JUGADORES", color: "magenta" },
  { icon: "BROWSER", text: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", color: "cyan" },
  { icon: "PLANT", text: "PROYECTO EN CONSTANTE CRECIMIENTO", color: "green" },
];
