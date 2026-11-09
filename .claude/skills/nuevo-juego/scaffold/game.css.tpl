/* __id__ — estilos del área del juego.
   Todas las reglas cuelgan de .__id__-root para no afectar a otras páginas.
   El canvas tiene resolución interna fija W×H y se escala por CSS dentro
   de .crt-screen, que es 4:3 (app/globals.css); si el campo no es 4:3, fija aspect-ratio en .__id__-root .crt-screen. */

.__id__-root {
  --g-overlay-bg: rgba(5, 5, 12, 0.78);
  --g-accent: var(--cyan);
  --g-accent-glow: rgba(0, 245, 255, 0.45);
  --g-kbd-bg: #0d0d1a;
  --g-kbd-border: rgba(0, 245, 255, 0.25);
  --g-text: var(--ink-dim);
  /* Alto ocupado por nav, HUD, márgenes y la barra del CRT: el marco se
     estrecha para que el campo 4:3 quepa entero en pantallas bajas. */
  --g-chrome: 380px;
  /* Proporción W/H del campo para el layout móvil compartido (SPEC 11).
     TODO: cámbiala si el campo no es 4:3 (p. ej. 1 para 1:1, 0.75 para 3:4). */
  --crt-ar: 1.3333;
}

/* ---- Marco y canvas ---- */
.__id__-root .crt {
  width: 100%;
  /* TODO: si el campo no es 4:3, cambia 4 / 3 por W / H aquí y añade
     .__id__-root .crt-screen { aspect-ratio: W / H; } */
  max-width: max(320px, calc((100svh - var(--g-chrome)) * 4 / 3 + 48px));
  margin-inline: auto;
}

/* La viñeta del CRT (::before) queda sobre el canvas; las scanlines (::after)
   ya lo están por orden del DOM. */
.__id__-root .crt-screen::before {
  z-index: 1;
}

.__id__-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

/* ---- Overlays (inicio y pausa) sobre el campo ---- */
.__id__-overlay {
  position: absolute;
  inset: 0;
  z-index: 2; /* por encima del canvas, la viñeta y las scanlines */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: var(--g-overlay-bg);
  backdrop-filter: blur(2px);
  line-height: 1.4;
  text-align: center;
}

.__id__-overlay-title {
  margin: 0;
  font-family: var(--pixel);
  font-size: 18px;
  letter-spacing: 0.06em;
  color: var(--g-accent);
  text-shadow: 0 0 10px var(--g-accent-glow);
}

.__id__-hint {
  margin: 0;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--g-text);
}

.__id__-menu {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  width: min(240px, 100%);
}

.__id__-root .btn:focus-visible {
  outline: 2px solid var(--g-accent);
  outline-offset: 3px;
}

/* ---- Lista de controles ---- */
.__id__-controls {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--g-text);
}

.__id__-controls li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.__id__-controls .keys {
  display: inline-flex;
  gap: 4px;
}

.__id__-menu .__id__-controls {
  margin-bottom: 8px;
}

.__id__-root kbd {
  padding: 1px 6px;
  background: var(--g-kbd-bg);
  border: 1px solid var(--g-kbd-border);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
}

/* Bajo el CRT, los controles van en una fila centrada. */
.__id__-help {
  margin-top: 20px;
}

.__id__-help .__id__-controls {
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 24px;
  font-size: 12px;
}

/* ---- Móvil (vertical ≤ 840 px y horizontal bajo) ----
   HUD compacto, marco y tamaño del CRT vienen del layout compartido de
   app/globals.css (SPEC 11): aquí no se redefinen. Solo ajustes propios. */
@media (max-width: 840px) and (orientation: portrait),
  (orientation: landscape) and (max-height: 500px) {
  .__id__-select {
    height: var(--tap-min);
  }
  .__id__-overlay {
    gap: 10px;
  }
  .__id__-overlay-title {
    font-size: 14px;
  }
}
