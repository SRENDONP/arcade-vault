"use client";

import "./caida.css";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import { GameOverModal } from "@/components/game-over-modal";
import { useSession } from "@/components/session-provider";
import type { PlayableProps } from "@/games";
import {
  clampStartLevel,
  collide,
  clearFullLines,
  COLS,
  createBoard,
  createGenerator,
  dropIntervalForLevel,
  LINE_SCORES,
  levelForLines,
  MAX_START_LEVEL,
  onLinesCleared,
  PIECES,
  ROWS,
  rotateCW,
  type ActivePiece,
  type Board,
  type Generator,
} from "./core";
import { DEFAULT_PREFS, readPrefs, writePref, type CaidaPrefs } from "./prefs";
import {
  colorsFor,
  getSkin,
  SKINS,
  type DrawOpts,
  type Skin,
  type SkinName,
} from "./skins";

// ---------------------------------------------------------------------------
// Estado del bucle (vive en refs, fuera de React)
// ---------------------------------------------------------------------------

type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  lines: number;
  level: number;
  maxCombo: number;
};

type Engine = {
  board: Board;
  current: ActivePiece;
  next: ActivePiece;
  gen: Generator;
  startLevel: number; // el de la partida en curso
  score: number;
  lines: number;
  level: number;
  combo: number; // piezas seguidas que borran al menos una línea
  maxCombo: number;
  dropInterval: number;
  dropAccum: number;
  over: boolean;
};

const BLOCK = 30; // px por celda del tablero (300×600)
const NEXT_BLOCK = 30; // px por celda de la vista SIGUIENTE (120×120 = 4×4)
const WALL_KICKS = [0, -1, 1, -2, 2];
const GHOST_ALPHA = 0.2;

// Teclas del juego: se les hace preventDefault para que la página no haga scroll.
const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "KeyX",
]);
const PAUSE_KEYS = new Set(["KeyP", "Escape"]);
const ENTER_KEYS = new Set(["Enter", "NumpadEnter"]);

function newPiece(gen: Generator): ActivePiece {
  const type = gen.next();
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function spawn(e: Engine) {
  e.current = e.next;
  e.next = newPiece(e.gen);
  if (collide(e.board, e.current.shape, e.current.x, e.current.y))
    e.over = true;
}

function createEngine(startLevel: number): Engine {
  const gen = createGenerator();
  const first = newPiece(gen);
  const e: Engine = {
    board: createBoard(),
    current: first,
    next: first,
    gen,
    startLevel,
    score: 0,
    lines: 0,
    level: startLevel,
    combo: 0,
    maxCombo: 0,
    dropInterval: dropIntervalForLevel(startLevel),
    dropAccum: 0,
    over: false,
  };
  spawn(e);
  return e;
}

function lockPiece(e: Engine) {
  const { shape, x, y } = e.current;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) e.board[y + r][x + c] = shape[r][c];
    }
  }
  const cleared = clearFullLines(e.board);
  onLinesCleared(cleared, e.gen); // 4 líneas dejan pendiente la pieza 1×1
  e.combo = cleared ? e.combo + 1 : 0;
  e.maxCombo = Math.max(e.maxCombo, e.combo);
  if (cleared) {
    e.lines += cleared;
    e.score += (LINE_SCORES[cleared] ?? 0) * e.level;
    e.level = levelForLines(e.lines, e.startLevel);
    e.dropInterval = dropIntervalForLevel(e.level);
  }
  spawn(e);
}

function moveX(e: Engine, dx: number) {
  if (!collide(e.board, e.current.shape, e.current.x + dx, e.current.y))
    e.current.x += dx;
}

function rotate(e: Engine) {
  const rotated = rotateCW(e.current.shape);
  for (const kick of WALL_KICKS) {
    if (!collide(e.board, rotated, e.current.x + kick, e.current.y)) {
      e.current.shape = rotated;
      e.current.x += kick;
      return;
    }
  }
}

// Caída automática: baja una fila o, si no puede, fija la pieza.
function gravity(e: Engine) {
  if (!collide(e.board, e.current.shape, e.current.x, e.current.y + 1))
    e.current.y++;
  else lockPiece(e);
}

function softDrop(e: Engine) {
  if (!collide(e.board, e.current.shape, e.current.x, e.current.y + 1)) {
    e.current.y++;
    e.score += 1;
  } else {
    lockPiece(e);
  }
}

function ghostY(e: Engine): number {
  let gy = e.current.y;
  while (!collide(e.board, e.current.shape, e.current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop(e: Engine) {
  const gy = ghostY(e);
  e.score += (gy - e.current.y) * 2;
  e.current.y = gy;
  lockPiece(e);
}

function statsOf(e: Engine): RunStats {
  return {
    score: e.score,
    lines: e.lines,
    level: e.level,
    maxCombo: e.maxCombo,
  };
}

// ---------------------------------------------------------------------------
// Dibujo en canvas
// ---------------------------------------------------------------------------

type Look = {
  skin: Skin;
  colors: (string | null)[];
  grid: string;
  shine: string;
};

function readLook(root: HTMLElement | null, skinName: SkinName): Look {
  const skin = getSkin(skinName);
  const css = root ? getComputedStyle(root) : null;
  return {
    skin,
    colors: colorsFor(skin),
    grid: css?.getPropertyValue("--grid").trim() || "rgba(0, 245, 255, 0.07)",
    shine:
      css?.getPropertyValue("--block-shine").trim() ||
      "rgba(255, 255, 255, 0.12)",
  };
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  look: Look,
  cx: number,
  cy: number,
  type: number,
  size: number,
  opts: DrawOpts,
) {
  const color = look.colors[type];
  if (!type || !color) return;
  ctx.globalAlpha = opts.ghost ? GHOST_ALPHA : 1;
  look.skin.draw(ctx, cx * size, cy * size, size, color, opts);
  ctx.globalAlpha = 1;
}

// Sin partida (pantalla de inicio) solo se dibuja la rejilla vacía.
function drawBoard(
  ctx: CanvasRenderingContext2D,
  e: Engine | null,
  look: Look,
) {
  ctx.clearRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

  ctx.strokeStyle = look.grid;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
  }
  ctx.stroke();
  if (!e) return;

  const solid: DrawOpts = { shine: look.shine };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, look, c, r, e.board[r][c], BLOCK, solid);
  }

  if (e.over) return;
  const { shape, x, y } = e.current;
  const gy = ghostY(e);
  const ghost: DrawOpts = { shine: look.shine, ghost: true };
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(ctx, look, x + c, gy + r, shape[r][c], BLOCK, ghost);
  }
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(ctx, look, x + c, y + r, shape[r][c], BLOCK, solid);
  }
}

function drawNext(ctx: CanvasRenderingContext2D, e: Engine | null, look: Look) {
  ctx.clearRect(0, 0, 4 * NEXT_BLOCK, 4 * NEXT_BLOCK);
  if (!e) return;
  const { shape } = e.next;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  const opts: DrawOpts = { shine: look.shine };
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      drawBlock(ctx, look, offX + c, offY + r, shape[r][c], NEXT_BLOCK, opts);
    }
  }
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Preferencias (skin, tema, nivel inicial)
// ---------------------------------------------------------------------------
// Mismo patrón que components/session-provider.tsx: useSyncExternalStore con
// DEFAULT_PREFS como snapshot de servidor, así el render del servidor y el de
// hidratación coinciden y readPrefs() solo se usa en el cliente tras montar.
// Los cambios de esta sesión se guardan también en memoria: con localStorage
// bloqueado se siguen aplicando y solo dejan de persistir.

const prefListeners = new Set<() => void>();
const sessionPrefs: Partial<CaidaPrefs> = {};

function subscribePrefs(listener: () => void) {
  prefListeners.add(listener);
  window.addEventListener("storage", listener); // otras pestañas
  return () => {
    prefListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// Snapshot como texto: estable entre llamadas mientras no cambie ningún valor.
const prefsSnapshot = () => JSON.stringify({ ...readPrefs(), ...sessionPrefs });
const SERVER_PREFS = JSON.stringify(DEFAULT_PREFS);
const serverPrefsSnapshot = () => SERVER_PREFS;

function setPref<K extends keyof CaidaPrefs>(key: K, value: CaidaPrefs[K]) {
  sessionPrefs[key] = value;
  writePref(key, value);
  prefListeners.forEach((l) => l());
}

function usePrefs(): CaidaPrefs {
  const raw = useSyncExternalStore(
    subscribePrefs,
    prefsSnapshot,
    serverPrefsSnapshot,
  );
  return useMemo(() => JSON.parse(raw) as CaidaPrefs, [raw]);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// Tras un clic, el botón suelta el foco para que Espacio (caída) no lo vuelva a pulsar.
const blurTarget = (ev: MouseEvent<HTMLElement>) => ev.currentTarget.blur();

export function CaidaGame({ game }: PlayableProps) {
  const { user } = useSession();
  const name = user?.name ?? "INVITADO";

  const [phase, setPhase] = useState<Phase>("start");
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const [stats, setStats] = useState<RunStats>({
    score: 0,
    lines: 0,
    level: DEFAULT_PREFS.startLevel,
    maxCombo: 0,
  });
  const { skin, theme, startLevel } = usePrefs();

  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const levelDownRef = useRef<HTMLButtonElement>(null);
  const levelUpRef = useRef<HTMLButtonElement>(null);

  const engineRef = useRef<Engine | null>(null);
  const lookRef = useRef<Look | null>(null);
  // Copias de estado para los listeners, que leen antes de que React re-renderice.
  const phaseRef = useRef<Phase>(phase);
  const pauseViewRef = useRef<PauseView>(pauseView);
  const startLevelRef = useRef(startLevel);
  // Qué botón del stepper cambió el nivel, para no perder el foco si se deshabilita.
  const stepFocusRef = useRef<"down" | "up" | null>(null);
  // Teclas pulsadas ahora mismo. Al reanudar, las que sigan pulsadas se
  // ignoran hasta soltarlas, para que la autorrepetición no mueva la pieza.
  const pressedRef = useRef(new Set<string>());
  const suppressedRef = useRef(new Set<string>());

  const goTo = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const showPauseView = useCallback((view: PauseView) => {
    pauseViewRef.current = view;
    setPauseView(view);
  }, []);

  // Copia al HUD solo lo que cambió; si nada cambió React no re-renderiza.
  const sync = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    setStats((prev) =>
      prev.score === e.score &&
      prev.lines === e.lines &&
      prev.level === e.level &&
      prev.maxCombo === e.maxCombo
        ? prev
        : statsOf(e),
    );
  }, []);

  const draw = useCallback(() => {
    const look = lookRef.current;
    if (!look) return;
    const e = engineRef.current;
    const ctx = boardRef.current?.getContext("2d");
    const nctx = nextRef.current?.getContext("2d");
    if (ctx) drawBoard(ctx, e, look);
    if (nctx) drawNext(nctx, e, look);
  }, []);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    showPauseView("main");
    goTo("paused");
  }, [goTo, showPauseView]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    suppressedRef.current = new Set(pressedRef.current);
    goTo("playing");
  }, [goTo]);

  // Partida nueva con el nivel inicial guardado (JUGAR, Enter, Reiniciar, JUGAR DE NUEVO).
  const startRun = useCallback(() => {
    const e = createEngine(startLevelRef.current);
    engineRef.current = e;
    suppressedRef.current = new Set(pressedRef.current);
    setStats(statsOf(e));
    showPauseView("main");
    goTo("playing");
    draw();
  }, [draw, goTo, showPauseView]);

  const endRun = useCallback(() => {
    const e = engineRef.current;
    const ph = phaseRef.current;
    if (!e || (ph !== "playing" && ph !== "paused")) return;
    e.over = true;
    sync();
    draw();
    goTo("over");
  }, [draw, goTo, sync]);

  const changeStartLevel = useCallback((delta: number, from: "down" | "up") => {
    const value = clampStartLevel(startLevelRef.current + delta);
    if (value === startLevelRef.current) return;
    startLevelRef.current = value;
    stepFocusRef.current = from;
    setPref("startLevel", value);
  }, []);

  // Al cargar las preferencias guardadas (tras hidratar) el ref recibe el nivel inicial.
  useEffect(() => {
    startLevelRef.current = startLevel;
  }, [startLevel]);

  // Si el botón enfocado del stepper se deshabilita al llegar al límite, el foco pasa al otro.
  useEffect(() => {
    const from = stepFocusRef.current;
    stepFocusRef.current = null;
    if (!from) return;
    const atLimit =
      from === "down" ? startLevel <= 1 : startLevel >= MAX_START_LEVEL;
    const target = atLimit
      ? from === "down"
        ? levelUpRef
        : levelDownRef
      : from === "down"
        ? levelDownRef
        : levelUpRef;
    target.current?.focus({ preventScroll: true });
  }, [startLevel]);

  // Foco inicial de cada pantalla: JUGAR al empezar, Reanudar / Volver en la pausa.
  useEffect(() => {
    if (phase === "start") playBtnRef.current?.focus({ preventScroll: true });
    if (phase === "paused") {
      (pauseView === "controls" ? backBtnRef : resumeBtnRef).current?.focus({
        preventScroll: true,
      });
    }
  }, [phase, pauseView]);

  // Al salir con SALIR la ruta queda oculta (<Activity> de cacheComponents) y
  // conserva el estado: una partida en curso queda en pausa para la vuelta.
  useEffect(
    () => () => {
      if (phaseRef.current !== "playing") return;
      pauseViewRef.current = "main";
      phaseRef.current = "paused";
      setPauseView("main");
      setPhase("paused");
    },
    [],
  );

  // Skin y tema: relee colores y variables CSS del contenedor y repinta
  // (si el juego está en pausa o terminado, el bucle no lo hace).
  useEffect(() => {
    lookRef.current = readLook(rootRef.current, skin);
    draw();
  }, [skin, theme, draw]);

  // Bucle requestAnimationFrame: solo corre en "playing".
  useEffect(() => {
    if (phase !== "playing") return;
    let id = 0;
    let last = performance.now();
    const frame = (ts: number) => {
      const e = engineRef.current;
      if (!e) return;
      e.dropAccum += ts - last;
      last = ts;
      if (e.dropAccum >= e.dropInterval) {
        e.dropAccum = 0;
        gravity(e);
        sync();
      }
      draw();
      if (e.over) {
        goTo("over");
        return;
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [phase, draw, sync, goTo]);

  // Teclado y foco de la ventana: un solo juego de listeners por montaje.
  useEffect(() => {
    const pressed = pressedRef.current;

    // Con el menú abierto el juego no recibe teclas: ↑ ↓ recorren los botones,
    // ← → cambian el nivel inicial con el foco en el stepper, P / Esc salen.
    const onMenuKey = (ev: KeyboardEvent) => {
      if (PAUSE_KEYS.has(ev.code)) {
        ev.preventDefault();
        if (ev.repeat) return;
        if (ev.code === "Escape" && pauseViewRef.current === "controls")
          showPauseView("main");
        else resume();
        return;
      }
      const menu = menuRef.current;
      if (!menu) return;
      const active = document.activeElement;
      switch (ev.code) {
        case "ArrowUp":
        case "ArrowDown": {
          ev.preventDefault();
          const items = [
            ...menu.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ];
          if (!items.length) return;
          const idx = items.indexOf(active as HTMLButtonElement);
          const step = ev.code === "ArrowDown" ? 1 : -1;
          items[
            idx < 0 ? 0 : (idx + step + items.length) % items.length
          ].focus();
          break;
        }
        case "ArrowLeft":
        case "ArrowRight":
          ev.preventDefault();
          if (
            active === levelDownRef.current ||
            active === levelUpRef.current
          ) {
            changeStartLevel(
              ev.code === "ArrowRight" ? 1 : -1,
              ev.code === "ArrowRight" ? "up" : "down",
            );
          }
          break;
        case "Space":
          // Espacio pulsa el botón enfocado; si no hay ninguno, que no haga scroll.
          if (!(active instanceof HTMLButtonElement && menu.contains(active)))
            ev.preventDefault();
          break;
      }
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      pressed.add(ev.code);
      const ph = phaseRef.current;

      if (ph === "start") {
        if (ENTER_KEYS.has(ev.code)) {
          ev.preventDefault(); // evita además el clic nativo del botón JUGAR enfocado
          if (!ev.repeat) startRun();
        }
        return;
      }
      if (ph === "paused") {
        onMenuKey(ev);
        return;
      }
      if (ph !== "playing") return;

      // En el selector de skin las flechas cambian la opción, no mueven la pieza.
      const t = ev.target;
      if (t instanceof HTMLSelectElement || t instanceof HTMLInputElement)
        return;

      if (PAUSE_KEYS.has(ev.code)) {
        ev.preventDefault();
        if (!ev.repeat) pause();
        return;
      }
      if (!GAME_KEYS.has(ev.code)) return;
      ev.preventDefault();
      if (suppressedRef.current.has(ev.code)) return;

      const e = engineRef.current;
      if (!e) return;
      switch (ev.code) {
        case "ArrowLeft":
          moveX(e, -1);
          break;
        case "ArrowRight":
          moveX(e, 1);
          break;
        case "ArrowDown":
          softDrop(e);
          break;
        case "ArrowUp":
        case "KeyX":
          rotate(e);
          break;
        case "Space":
          hardDrop(e);
          break;
      }
      sync();
      draw();
      if (e.over) goTo("over");
    };

    const onKeyUp = (ev: KeyboardEvent) => {
      pressed.delete(ev.code);
      suppressedRef.current.delete(ev.code);
    };

    // Perder el foco (otra pestaña u otra ventana) abre la pausa. Sin foco no
    // llegan los keyup: se olvidan las teclas pulsadas.
    const onBlur = () => {
      pressed.clear();
      suppressedRef.current.clear();
      pause();
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    changeStartLevel,
    draw,
    goTo,
    pause,
    resume,
    showPauseView,
    startRun,
    sync,
  ]);

  const inRun = phase === "playing" || phase === "paused";
  // Antes de la primera partida el HUD muestra el nivel con el que empezará.
  const hudLevel = phase === "start" ? startLevel : stats.level;

  return (
    <div
      ref={rootRef}
      className="caida-root av-player fade-in"
      data-theme={theme}
      data-skin={skin}
    >
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v text-ink">{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{stats.score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lines">
            <div className="l">Líneas</div>
            <div className="v">{stats.lines}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{pad2(hudLevel)}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            className="btn yellow"
            disabled={!inRun}
            onClick={(ev) => {
              blurTarget(ev);
              if (phase === "paused") resume();
              else pause();
            }}
          >
            {phase === "paused" ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            className="btn magenta"
            disabled={!inRun}
            onClick={(ev) => {
              blurTarget(ev);
              endRun();
            }}
          >
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="caida-stage">
            <canvas
              ref={boardRef}
              className="caida-board"
              width={COLS * BLOCK}
              height={ROWS * BLOCK}
              aria-label={`Tablero de ${game.title}`}
              role="img"
            />

            <aside className="caida-panel" aria-label="Panel del juego">
              <section className="caida-section">
                <h3 className="caida-label">Siguiente</h3>
                <canvas
                  ref={nextRef}
                  className="caida-next"
                  width={4 * NEXT_BLOCK}
                  height={4 * NEXT_BLOCK}
                  aria-label="Siguiente pieza"
                  role="img"
                />
              </section>

              <section className="caida-section">
                <label className="caida-label" htmlFor="caida-skin">
                  Skin
                </label>
                <select
                  id="caida-skin"
                  className="caida-select"
                  value={skin}
                  onChange={(ev) => {
                    setPref("skin", ev.target.value as SkinName);
                    ev.currentTarget.blur(); // devuelve el teclado al juego
                  }}
                >
                  {(Object.keys(SKINS) as SkinName[]).map((key) => (
                    <option key={key} value={key}>
                      {SKINS[key].label}
                    </option>
                  ))}
                </select>
              </section>

              <section className="caida-section">
                <span className="caida-label" id="caida-theme-label">
                  Tema
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === "light"}
                  aria-labelledby="caida-theme-label"
                  className="caida-toggle"
                  onClick={(ev) => {
                    blurTarget(ev);
                    setPref("theme", theme === "light" ? "dark" : "light");
                  }}
                >
                  <span className="caida-switch" aria-hidden="true" />
                  <span>{theme === "light" ? "Claro" : "Oscuro"}</span>
                </button>
              </section>

              <section className="caida-section">
                <h3 className="caida-label">Controles</h3>
                <ControlsList />
              </section>
            </aside>
          </div>

          {phase === "start" && (
            <div
              className="caida-overlay"
              role="dialog"
              aria-labelledby="caida-start-title"
            >
              <p id="caida-start-title" className="caida-overlay-title">
                ¿JUGAMOS?
              </p>
              <button
                ref={playBtnRef}
                className="btn lg pulse"
                onClick={startRun}
              >
                JUGAR
              </button>
              <p className="caida-hint">
                o pulsa <kbd>Enter</kbd>
              </p>
            </div>
          )}

          {phase === "paused" && (
            <div
              ref={menuRef}
              className="caida-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="caida-pause-title"
            >
              <p id="caida-pause-title" className="caida-overlay-title">
                PAUSA
              </p>

              {pauseView === "main" ? (
                <div className="caida-menu">
                  <button ref={resumeBtnRef} className="btn" onClick={resume}>
                    REANUDAR
                  </button>
                  <button className="btn yellow" onClick={startRun}>
                    REINICIAR
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => showPauseView("controls")}
                  >
                    VER CONTROLES
                  </button>

                  <div className="caida-start-level">
                    <span className="caida-label" id="caida-start-level-label">
                      Nivel inicial
                    </span>
                    <div
                      className="caida-stepper"
                      role="group"
                      aria-labelledby="caida-start-level-label"
                    >
                      <button
                        ref={levelDownRef}
                        type="button"
                        className="caida-step"
                        aria-label="Bajar nivel inicial"
                        disabled={startLevel <= 1}
                        onClick={() => changeStartLevel(-1, "down")}
                      >
                        −
                      </button>
                      <output aria-live="polite">{pad2(startLevel)}</output>
                      <button
                        ref={levelUpRef}
                        type="button"
                        className="caida-step"
                        aria-label="Subir nivel inicial"
                        disabled={startLevel >= MAX_START_LEVEL}
                        onClick={() => changeStartLevel(1, "up")}
                      >
                        +
                      </button>
                    </div>
                    <span className="caida-hint">
                      Se aplica en la próxima partida
                    </span>
                  </div>
                </div>
              ) : (
                <div className="caida-menu">
                  <ControlsList />
                  <button
                    ref={backBtnRef}
                    className="btn ghost"
                    onClick={() => showPauseView("main")}
                  >
                    VOLVER
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>NIVEL {pad2(hudLevel)}</span>
        </div>
      </div>

      {phase === "over" && (
        <GameOverModal
          game={game}
          score={stats.score}
          ranked
          extra={[
            { label: "Líneas", value: String(stats.lines) },
            { label: "Combo máx.", value: String(stats.maxCombo) },
          ]}
          onRestart={startRun}
        />
      )}
    </div>
  );
}

function ControlsList() {
  return (
    <ul className="caida-controls">
      <li>
        <span className="keys">
          <kbd>←</kbd>
          <kbd>→</kbd>
        </span>
        mover
      </li>
      <li>
        <span className="keys">
          <kbd>↑</kbd>
          <kbd>X</kbd>
        </span>
        rotar
      </li>
      <li>
        <span className="keys">
          <kbd>↓</kbd>
        </span>
        bajar
      </li>
      <li>
        <span className="keys">
          <kbd>Espacio</kbd>
        </span>
        caída
      </li>
      <li>
        <span className="keys">
          <kbd>P</kbd>
          <kbd>Esc</kbd>
        </span>
        pausa
      </li>
    </ul>
  );
}
