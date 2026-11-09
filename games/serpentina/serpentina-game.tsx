"use client";

// SERPENTINA — componente jugable (SPEC 09). Derivado de
// .claude/skills/nuevo-juego/scaffold/game.tsx.tpl (integración de ROCAS):
// HUD, inicio, pausa, foco, <Activity>, modal y ranking se mantienen igual.

import "./serpentina.css";
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
  isAnimating,
  MAX_DT,
  START_LENGTH,
  step,
  W,
  type Dir,
  type SerpentinaState,
} from "./core";
import {
  DEFAULT_PREFS,
  readPrefs,
  writePref,
  type SerpentinaPrefs,
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
const sessionPrefs: Partial<SerpentinaPrefs> = {};

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

function setPref<K extends keyof SerpentinaPrefs>(
  key: K,
  value: SerpentinaPrefs[K],
) {
  sessionPrefs[key] = value;
  writePref(key, value);
  prefListeners.forEach((l) => l());
}

function usePrefs(): SerpentinaPrefs {
  const raw = useSyncExternalStore(
    subscribePrefs,
    prefsSnapshot,
    serverPrefsSnapshot,
  );
  return useMemo(() => JSON.parse(raw) as SerpentinaPrefs, [raw]);
}

// ---------------------------------------------------------------------------
// Estado visible (React) y estado del bucle (refs)
// ---------------------------------------------------------------------------

type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  level: number;
  length: number;
  bonusEaten: number;
};

const INITIAL_STATS: RunStats = {
  score: 0,
  level: 1,
  length: START_LENGTH,
  bonusEaten: 0,
};

// Teclas de dirección: una entrada en la cola por pulsación (sin autorrepetición).
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
// Todas reciben preventDefault (sin scroll). Espacio no hace nada en el juego.
const GAME_KEYS = new Set([...Object.keys(DIR_KEYS), "Space"]);
const PAUSE_KEYS = new Set(["KeyP", "Escape"]);
const ENTER_KEYS = new Set(["Enter", "NumpadEnter"]);

const statsOf = (s: SerpentinaState): RunStats => ({
  score: s.score,
  level: s.level,
  length: s.body.length,
  bonusEaten: s.bonusEaten,
});

const sameStats = (a: RunStats, b: RunStats) =>
  a.score === b.score &&
  a.level === b.level &&
  a.length === b.length &&
  a.bonusEaten === b.bonusEaten;

// Controles táctiles (SPEC 12): A y B no se usan en SERPENTINA.
const TOUCH_DISABLED = { a: true, b: true } as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

// Tras un clic, el botón suelta el foco para que Espacio no lo vuelva a pulsar.
const blurTarget = (ev: MouseEvent<HTMLElement>) => ev.currentTarget.blur();

export function SerpentinaGame({ game }: PlayableProps) {
  const { user } = useSession();
  const name = user?.name ?? "INVITADO";

  const [phase, setPhase] = useState<Phase>("start");
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const [stats, setStats] = useState<RunStats>(INITIAL_STATS);
  const { skin } = usePrefs();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);

  // Estado de la partida: sobrevive al ocultarse la ruta (<Activity>), porque
  // la limpieza de los efectos no lo reinicia.
  const engineRef = useRef<SerpentinaState | null>(null);
  // Copias de estado para los listeners, que leen antes de que React re-renderice.
  const phaseRef = useRef<Phase>(phase);
  const pauseViewRef = useRef<PauseView>(pauseView);
  // Teclas pulsadas ahora mismo. Al reanudar o empezar, las que sigan pulsadas
  // se ignoran hasta soltarlas.
  const pressedRef = useRef(new Set<string>());
  const suppressedRef = useRef(new Set<string>());
  // Direcciones pulsadas desde el último frame, en orden (cola de giros).
  const turnsRef = useRef<Dir[]>([]);
  // Estado de los controles táctiles; lo escribe <TouchControls>. Objeto
  // mutable y estable (useState perezoso: se pasa en el render, cosa que la
  // regla react-hooks/refs no permite con un ref) que no se reinicia en la
  // limpieza de efectos.
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

  // Un giro pulsado antes de la pausa no se ejecuta al reanudar.
  const clearTurns = useCallback(() => {
    turnsRef.current = [];
    if (engineRef.current) engineRef.current.queue = [];
  }, []);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    clearTurns();
    showPauseView("main");
    goTo("paused");
  }, [clearTurns, goTo, showPauseView]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    suppressedRef.current = new Set(pressedRef.current);
    turnsRef.current = [];
    goTo("playing");
  }, [goTo]);

  // Partida nueva (JUGAR, Enter, Reiniciar, JUGAR DE NUEVO).
  const startRun = useCallback(() => {
    const s = createState(Math.random);
    engineRef.current = s;
    suppressedRef.current = new Set(pressedRef.current);
    turnsRef.current = [];
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
      turnsRef.current = [];
      if (engineRef.current) engineRef.current.queue = [];
      pauseViewRef.current = "main";
      phaseRef.current = "paused";
      setPauseView("main");
      setPhase("paused");
    },
    [],
  );

  // En pausa el bucle no corre: al volver a mostrarse la ruta se repinta el
  // último frame (el canvas puede haberse vaciado).
  useEffect(() => {
    if (phase === "paused") draw();
  }, [phase, draw]);

  // Bucle requestAnimationFrame. En "over" sigue sin entrada mientras el motor
  // tenga animación final (isAnimating).
  useEffect(() => {
    if (phase !== "playing" && phase !== "over") return;
    let id = 0;
    let last = performance.now(); // reinicio al montar o reanudar: sin saltos
    const frame = (ts: number) => {
      const s = engineRef.current;
      if (!s) return;
      const dt = Math.min(Math.max((ts - last) / 1000, 0), MAX_DT);
      last = ts;

      const turns = phaseRef.current === "playing" ? turnsRef.current : [];
      turnsRef.current = [];

      step(s, dt, { turns });
      sync();
      draw();

      if (phaseRef.current === "playing" && s.state === "gameover") {
        goTo("over");
        return; // el efecto de "over" toma el relevo
      }
      if (phaseRef.current === "over" && !isAnimating(s)) return;
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [phase, draw, sync, goTo]);

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
      // no giran la serpiente ni cuentan como teclas pulsadas. P / Esc siguen
      // abriendo y cerrando la pausa.
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
      // La autorrepetición del teclado no encola giros nuevos.
      const d = DIR_KEYS[ev.code];
      if (d && !ev.repeat) turnsRef.current.push(d);
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

  // D-pad táctil: cada flecha nueva encola un giro, como una tecla sin
  // autorrepetición. En una diagonal solo llega la flecha recién pulsada, así
  // que manda la última dirección.
  const onTouchPress = useCallback((ev: TouchPressEvent) => {
    if (phaseRef.current !== "playing" || ev.repeated) return;
    if (ev.button === "a" || ev.button === "b") return;
    turnsRef.current.push(ev.button);
  }, []);

  const inRun = phase === "playing" || phase === "paused";

  return (
    <div className="serpentina-root av-player fade-in" data-skin={skin}>
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
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{pad2(stats.level)}</div>
          </div>
          <div className="hud-stat length">
            <div className="l">Longitud</div>
            <div className="v">{stats.length}</div>
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
            className="serpentina-canvas"
            width={W}
            height={H}
            aria-label={`Campo de juego de ${game.title}`}
            role="img"
          />

          {phase === "start" && (
            <div
              className="serpentina-overlay"
              role="dialog"
              aria-labelledby="serpentina-start-title"
            >
              <p
                id="serpentina-start-title"
                className="serpentina-overlay-title"
              >
                ¿JUGAMOS?
              </p>
              <button
                ref={playBtnRef}
                className="btn lg pulse"
                onClick={startRun}
              >
                JUGAR
              </button>
              <p className="serpentina-hint">
                o pulsa <kbd>Enter</kbd>
              </p>
            </div>
          )}

          {phase === "paused" && (
            <div
              ref={menuRef}
              className="serpentina-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="serpentina-pause-title"
            >
              <p
                id="serpentina-pause-title"
                className="serpentina-overlay-title"
              >
                PAUSA
              </p>
              {pauseView === "main" ? (
                <div className="serpentina-menu">
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
                <div className="serpentina-menu">
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

      <div className="serpentina-skin-row">
        <section className="serpentina-help" aria-label="Controles">
          <ControlsList />
        </section>
        <div className="serpentina-skin">
          <label className="serpentina-label" htmlFor="serpentina-skin">
            Skin
          </label>
          <select
            id="serpentina-skin"
            className="serpentina-select"
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
            { label: "Longitud", value: String(stats.length) },
            { label: "Bonus", value: String(stats.bonusEaten) },
          ]}
          onRestart={startRun}
        />
      )}
    </div>
  );
}

function ControlsList() {
  return (
    <ul className="serpentina-controls">
      <li>
        <span className="keys">
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          <kbd>←</kbd>
          <kbd>→</kbd>
        </span>
        girar
      </li>
      <li>
        <span className="keys">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
        </span>
        girar
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
