"use client";

// __id__ — componente jugable. Derivado de games/rocas/rocas-game.tsx: la
// integración (HUD, inicio, pausa, foco, <Activity>, modal y ranking) se
// mantiene igual; los TODO marcan lo propio del juego.

import "./__id__.css";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { GameOverModal } from "@/components/game-over-modal";
import { useSession } from "@/components/session-provider";
import type { PlayableProps } from "@/games";
import {
  createState,
  H,
  isAnimating,
  MAX_DT,
  START_LIVES,
  step,
  W,
  type __Pascal__Input,
  type __Pascal__State,
} from "./core";
import { drawFrame } from "./render";

// ---------------------------------------------------------------------------
// Estado visible (React) y estado del bucle (refs)
// ---------------------------------------------------------------------------

type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
// TODO: solo lo que muestran el HUD y el modal.
type RunStats = {
  score: number;
  lives: number;
  level: number;
};

const INITIAL_STATS: RunStats = { score: 0, lives: START_LIVES, level: 1 };

// TODO: teclas del juego. Todas reciben preventDefault (sin scroll).
const HELD_KEYS = new Set(["ArrowLeft", "ArrowRight"]); // se leen cada frame
const PULSE_KEYS = new Set(["Space"]); // una acción por pulsación
const GAME_KEYS = new Set([...HELD_KEYS, ...PULSE_KEYS]);
const PAUSE_KEYS = new Set(["KeyP", "Escape"]);
const ENTER_KEYS = new Set(["Enter", "NumpadEnter"]);

const NO_INPUT: __Pascal__Input = { left: false, right: false, action: false };

// TODO: traducir teclas a la entrada del motor.
function readInput(
  held: (code: string) => boolean,
  pulsed: (code: string) => boolean,
): __Pascal__Input {
  return {
    left: held("ArrowLeft"),
    right: held("ArrowRight"),
    action: pulsed("Space"),
  };
}

const statsOf = (s: __Pascal__State): RunStats => ({
  score: s.score,
  lives: s.lives,
  level: s.level,
});

const sameStats = (a: RunStats, b: RunStats) =>
  a.score === b.score && a.lives === b.lives && a.level === b.level;

const pad2 = (n: number) => String(n).padStart(2, "0");

// Tras un clic, el botón suelta el foco para que Espacio no lo vuelva a pulsar.
const blurTarget = (ev: MouseEvent<HTMLElement>) => ev.currentTarget.blur();

export function __Pascal__Game({ game }: PlayableProps) {
  const { user } = useSession();
  const name = user?.name ?? "INVITADO";

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
  const engineRef = useRef<__Pascal__State | null>(null);
  // Copias de estado para los listeners, que leen antes de que React re-renderice.
  const phaseRef = useRef<Phase>(phase);
  const pauseViewRef = useRef<PauseView>(pauseView);
  // Teclas pulsadas ahora mismo. Al reanudar o empezar, las que sigan pulsadas
  // se ignoran hasta soltarlas.
  const pressedRef = useRef(new Set<string>());
  const suppressedRef = useRef(new Set<string>());
  // Pulsaciones pendientes para el próximo frame (una acción por pulsación).
  const pulsesRef = useRef(new Set<string>());

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
    if (s && ctx) drawFrame(ctx, s, performance.now());
  }, []);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    pulsesRef.current.clear();
    showPauseView("main");
    goTo("paused");
  }, [goTo, showPauseView]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    suppressedRef.current = new Set(pressedRef.current);
    pulsesRef.current.clear();
    goTo("playing");
  }, [goTo]);

  // Partida nueva (JUGAR, Enter, Reiniciar, JUGAR DE NUEVO).
  const startRun = useCallback(() => {
    const s = createState(Math.random);
    engineRef.current = s;
    suppressedRef.current = new Set(pressedRef.current);
    pulsesRef.current.clear();
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

      const held = (code: string) =>
        pressedRef.current.has(code) && !suppressedRef.current.has(code);
      const pulsed = (code: string) => pulsesRef.current.has(code);
      const input =
        phaseRef.current === "playing" ? readInput(held, pulsed) : NO_INPUT;
      pulsesRef.current.clear();

      step(s, dt, input);
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
      if (PULSE_KEYS.has(ev.code) && !ev.repeat) pulsesRef.current.add(ev.code);
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

  const inRun = phase === "playing" || phase === "paused";

  return (
    <div className="__id__-root av-player fade-in">
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
          {/* TODO: stats propios del juego (quitar los que no apliquen). */}
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
            className="__id__-canvas"
            width={W}
            height={H}
            aria-label={`Campo de juego de ${game.title}`}
            role="img"
          />

          {phase === "start" && (
            <div
              className="__id__-overlay"
              role="dialog"
              aria-labelledby="__id__-start-title"
            >
              <p id="__id__-start-title" className="__id__-overlay-title">
                ¿JUGAMOS?
              </p>
              <button
                ref={playBtnRef}
                className="btn lg pulse"
                onClick={startRun}
              >
                JUGAR
              </button>
              <p className="__id__-hint">
                o pulsa <kbd>Enter</kbd>
              </p>
              <p className="touch-notice">
                Controles táctiles próximamente · necesitas un teclado
              </p>
            </div>
          )}

          {phase === "paused" && (
            <div
              ref={menuRef}
              className="__id__-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="__id__-pause-title"
            >
              <p id="__id__-pause-title" className="__id__-overlay-title">
                PAUSA
              </p>
              {pauseView === "main" ? (
                <div className="__id__-menu">
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
                <div className="__id__-menu">
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

      <section className="__id__-help" aria-label="Controles">
        <ControlsList />
      </section>

      {phase === "over" && (
        <GameOverModal
          game={game}
          score={stats.score}
          ranked
          extra={[
            // TODO: 1–3 datos de la partida (no se guardan en Supabase).
            { label: "Nivel", value: pad2(stats.level) },
          ]}
          onRestart={startRun}
        />
      )}
    </div>
  );
}

// TODO: controles reales del juego.
function ControlsList() {
  return (
    <ul className="__id__-controls">
      <li>
        <span className="keys">
          <kbd>←</kbd>
          <kbd>→</kbd>
        </span>
        mover
      </li>
      <li>
        <span className="keys">
          <kbd>Espacio</kbd>
        </span>
        acción
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
