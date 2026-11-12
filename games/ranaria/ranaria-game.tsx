"use client";

// RANARIA — componente jugable (SPEC 13). Derivado del scaffold de
// games/rocas/: la integración (HUD, inicio, pausa, foco, <Activity>, modal y
// ranking) se mantiene igual. La entrada son saltos discretos: una dirección
// por pulsación (teclado o D-pad táctil), en orden.

import "./ranaria.css";
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
import { TouchControls } from "@/components/touch-controls";
import type { PlayableProps } from "@/games";
import { createTouchInput, type TouchPressEvent } from "@/lib/touch-input";
import {
  createState,
  H,
  MAX_DT,
  START_LIVES,
  step,
  W,
  type Dir,
  type RanariaState,
} from "./core";
import {
  DEFAULT_PREFS,
  readPrefs,
  writePref,
  type RanariaPrefs,
} from "./prefs";
import { drawFrame } from "./render";
import { getSkin, SKINS, type SkinName } from "./skins";

// ---------------------------------------------------------------------------
// Preferencias (skin)
// ---------------------------------------------------------------------------
// Mismo patrón que games/caida/caida-game.tsx: useSyncExternalStore con
// DEFAULT_PREFS como snapshot de servidor, así el render del servidor y el de
// hidratación coinciden y readPrefs() solo se usa en el cliente tras montar.
// Los cambios de esta sesión se guardan también en memoria: con localStorage
// bloqueado se siguen aplicando y solo dejan de persistir.

const prefListeners = new Set<() => void>();
const sessionPrefs: Partial<RanariaPrefs> = {};

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

function setPref<K extends keyof RanariaPrefs>(key: K, value: RanariaPrefs[K]) {
  sessionPrefs[key] = value;
  writePref(key, value);
  prefListeners.forEach((l) => l());
}

function usePrefs(): RanariaPrefs {
  const raw = useSyncExternalStore(
    subscribePrefs,
    prefsSnapshot,
    serverPrefsSnapshot,
  );
  return useMemo(() => JSON.parse(raw) as RanariaPrefs, [raw]);
}

// ---------------------------------------------------------------------------
// Estado visible (React) y estado del bucle (refs)
// ---------------------------------------------------------------------------

type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  lives: number;
  level: number;
  lilies: number;
};

const INITIAL_STATS: RunStats = {
  score: 0,
  lives: START_LIVES,
  level: 1,
  lilies: 0,
};

// Flechas y W A S D: un salto por pulsación. Todas reciben preventDefault.
const DIR_KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};
const GAME_KEYS = new Set([...Object.keys(DIR_KEYS), "Space"]);
const PAUSE_KEYS = new Set(["KeyP", "Escape"]);
const ENTER_KEYS = new Set(["Enter", "NumpadEnter"]);

// A y B no se usan en este juego (se ven atenuados).
const TOUCH_DISABLED = { a: true, b: true } as const;

const statsOf = (s: RanariaState): RunStats => ({
  score: s.score,
  lives: s.lives,
  level: s.level,
  lilies: s.liliesTotal,
});

const sameStats = (a: RunStats, b: RunStats) =>
  a.score === b.score &&
  a.lives === b.lives &&
  a.level === b.level &&
  a.lilies === b.lilies;

const pad2 = (n: number) => String(n).padStart(2, "0");

// Tras un clic, el botón suelta el foco para que Espacio no lo vuelva a pulsar.
const blurTarget = (ev: MouseEvent<HTMLElement>) => ev.currentTarget.blur();

export function RanariaGame({ game }: PlayableProps) {
  const { user } = useSession();
  const name = user?.name ?? "INVITADO";
  const { skin } = usePrefs();

  const [phase, setPhase] = useState<Phase>("start");
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const [stats, setStats] = useState<RunStats>(INITIAL_STATS);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);

  // Estado de la partida: sobrevive al ocultarse la ruta (<Activity>), porque
  // la limpieza de los efectos no lo reinicia.
  const engineRef = useRef<RanariaState | null>(null);
  // Copias de estado para los listeners, que leen antes de que React re-renderice.
  const phaseRef = useRef<Phase>(phase);
  const pauseViewRef = useRef<PauseView>(pauseView);
  // Teclas pulsadas ahora mismo. Al reanudar o empezar, las que sigan pulsadas
  // se ignoran hasta soltarlas.
  const pressedRef = useRef(new Set<string>());
  const suppressedRef = useRef(new Set<string>());
  // Saltos pulsados desde el último frame, en orden (una entrada por pulsación).
  const jumpsRef = useRef<Dir[]>([]);
  // Estado de los controles táctiles; lo escribe <TouchControls>. Objeto
  // mutable y estable que no se reinicia en la limpieza de efectos.
  const [touch] = useState(createTouchInput);
  // Skin activo para el bucle y draw(); lo actualiza el efecto [skin, draw].
  const skinRef = useRef(getSkin(skin));

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
    const s = engineRef.current;
    if (!s) return;
    setStats((prev) => {
      const next = statsOf(s);
      return sameStats(prev, next) ? prev : next;
    });
  }, []);

  const draw = useCallback(() => {
    const s = engineRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (s && ctx) drawFrame(ctx, s, skinRef.current);
  }, []);

  // Al cambiar de skin se repinta (en pausa o fin el bucle no corre).
  useEffect(() => {
    skinRef.current = getSkin(skin);
    draw();
  }, [skin, draw]);

  // Descarta los saltos pulsados y el pendiente del motor (al pausar o reanudar).
  const dropJumps = useCallback(() => {
    jumpsRef.current = [];
    const s = engineRef.current;
    if (s) s.frog.pending = null;
  }, []);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    dropJumps();
    showPauseView("main");
    goTo("paused");
  }, [dropJumps, goTo, showPauseView]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    suppressedRef.current = new Set(pressedRef.current);
    dropJumps();
    goTo("playing");
  }, [dropJumps, goTo]);

  // Partida nueva (JUGAR, Enter, Reiniciar, JUGAR DE NUEVO).
  const startRun = useCallback(() => {
    const s = createState(Math.random);
    engineRef.current = s;
    suppressedRef.current = new Set(pressedRef.current);
    jumpsRef.current = [];
    setStats(statsOf(s));
    showPauseView("main");
    goTo("playing");
    draw();
  }, [draw, goTo, showPauseView]);

  // Botón FIN: termina la partida con la puntuación actual.
  const endRun = useCallback(() => {
    const s = engineRef.current;
    const ph = phaseRef.current;
    if (!s || (ph !== "playing" && ph !== "paused")) return;
    s.state = "gameover";
    sync();
    draw();
    goTo("over");
  }, [draw, goTo, sync]);

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

  // Fuera del bucle (pausa y fin) se repinta el último frame al montar: el
  // canvas puede haberse vaciado al volver a mostrarse la ruta.
  useEffect(() => {
    if (phase === "paused" || phase === "over") draw();
  }, [phase, draw]);

  // Bucle requestAnimationFrame: solo corre en "playing". `touch` va en las
  // dependencias por contrato (SPEC 12), aunque aquí el D-pad entra por onPress.
  useEffect(() => {
    if (phase !== "playing") return;
    let id = 0;
    let last = performance.now(); // reinicio al montar o reanudar: sin saltos
    const frame = (ts: number) => {
      const s = engineRef.current;
      if (!s) return;
      const dt = Math.min(Math.max((ts - last) / 1000, 0), MAX_DT);
      last = ts;

      const jumps = jumpsRef.current;
      jumpsRef.current = [];
      step(s, dt, { jumps });
      sync();
      draw();

      if (s.state === "gameover") {
        goTo("over");
        return;
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [phase, draw, sync, goTo, touch]);

  // Teclado y foco de la ventana: un solo juego de listeners por montaje.
  useEffect(() => {
    const pressed = pressedRef.current;

    // Con el menú abierto el juego no recibe teclas: ↑ ↓ recorren los botones
    // y P / Esc cierran (Esc en "Ver controles" vuelve al menú).
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
          const dir = ev.code === "ArrowDown" ? 1 : -1;
          items[
            idx < 0 ? 0 : (idx + dir + items.length) % items.length
          ].focus();
          break;
        }
        case "ArrowLeft":
        case "ArrowRight":
          ev.preventDefault();
          break;
        case "Space":
          // Espacio pulsa el botón enfocado; si no hay ninguno, que no haga scroll.
          if (!(active instanceof HTMLButtonElement && menu.contains(active)))
            ev.preventDefault();
          break;
      }
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      // En el selector de skin las flechas (y Enter, Espacio) son del <select>:
      // no hacen saltar a la rana ni cuentan como teclas pulsadas. P / Esc
      // siguen abriendo y cerrando la pausa.
      const t = ev.target;
      if (
        (t instanceof HTMLSelectElement || t instanceof HTMLInputElement) &&
        !PAUSE_KEYS.has(ev.code)
      )
        return;
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
      if (ph !== "playing") return; // "over": el teclado es del modal

      if (PAUSE_KEYS.has(ev.code)) {
        ev.preventDefault();
        if (!ev.repeat) pause();
        return;
      }
      if (!GAME_KEYS.has(ev.code)) return;
      ev.preventDefault();
      if (suppressedRef.current.has(ev.code)) return;
      // La autorrepetición del teclado no cuenta como pulsación nueva.
      const d = DIR_KEYS[ev.code];
      if (d && !ev.repeat) jumpsRef.current.push(d);
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
  }, [pause, resume, showPauseView, startRun]);

  // D-pad táctil: un salto por toque, igual que una flecha (sin repetición).
  const onTouchPress = useCallback((ev: TouchPressEvent) => {
    if (phaseRef.current !== "playing" || ev.repeated) return;
    if (ev.button === "a" || ev.button === "b") return;
    jumpsRef.current.push(ev.button);
  }, []);

  const inRun = phase === "playing" || phase === "paused";

  return (
    <div className="ranaria-root av-player fade-in" data-skin={skin}>
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
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v" aria-label={`${stats.lives} vidas`}>
              {"♥ ".repeat(stats.lives).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{pad2(stats.level)}</div>
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
          <canvas
            ref={canvasRef}
            className="ranaria-canvas"
            width={W}
            height={H}
            aria-label={`Campo de juego de ${game.title}`}
            role="img"
          />

          {phase === "start" && (
            <div
              className="ranaria-overlay"
              role="dialog"
              aria-labelledby="ranaria-start-title"
            >
              <p id="ranaria-start-title" className="ranaria-overlay-title">
                ¿JUGAMOS?
              </p>
              <button
                ref={playBtnRef}
                className="btn lg pulse"
                onClick={startRun}
              >
                JUGAR
              </button>
              <p className="ranaria-hint">
                o pulsa <kbd>Enter</kbd>
              </p>
            </div>
          )}

          {phase === "paused" && (
            <div
              ref={menuRef}
              className="ranaria-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ranaria-pause-title"
            >
              <p id="ranaria-pause-title" className="ranaria-overlay-title">
                PAUSA
              </p>
              {pauseView === "main" ? (
                <div className="ranaria-menu">
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
                </div>
              ) : (
                <div className="ranaria-menu">
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
          <span>NIVEL {pad2(stats.level)}</span>
        </div>
      </div>

      <TouchControls
        input={touch}
        active={phase === "playing"}
        disabled={TOUCH_DISABLED}
        onPress={onTouchPress}
        paused={phase === "paused"}
        pauseEnabled={inRun}
        onPauseToggle={phase === "paused" ? resume : pause}
      />

      <div className="ranaria-skin-row">
        <section className="ranaria-help" aria-label="Controles">
          <ControlsList />
        </section>
        <div className="ranaria-skin">
          <label className="ranaria-label" htmlFor="ranaria-skin">
            Skin
          </label>
          <select
            id="ranaria-skin"
            className="ranaria-select"
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
        </div>
      </div>

      {phase === "over" && (
        <GameOverModal
          game={game}
          score={stats.score}
          ranked
          extra={[
            { label: "Nivel", value: pad2(stats.level) },
            { label: "Nenúfares", value: pad2(stats.lilies) },
          ]}
          onRestart={startRun}
        />
      )}
    </div>
  );
}

function ControlsList() {
  return (
    <ul className="ranaria-controls">
      <li>
        <span className="keys">
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          <kbd>←</kbd>
          <kbd>→</kbd>
        </span>
        saltar
      </li>
      <li>
        <span className="keys">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
        </span>
        saltar
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
