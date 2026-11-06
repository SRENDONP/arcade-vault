"use client";

import "./bloque-buster.css";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
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
  type BloqueBusterInput,
  type BloqueBusterState,
  type SoundEvent,
} from "./core";
import { readMuted, writeMuted } from "./prefs";
import { drawFrame } from "./render";

// ---------------------------------------------------------------------------
// Estado visible (React) y estado del bucle (refs)
// ---------------------------------------------------------------------------

type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type Result = "VICTORIA" | "DERROTA";
type RunStats = {
  score: number;
  lives: number;
  level: number;
  bricksBroken: number;
  levelClear: boolean; // overlay de "nivel superado"
  result: Result | null; // solo al terminar la partida
};

const INITIAL_STATS: RunStats = {
  score: 0,
  lives: START_LIVES,
  level: 1,
  bricksBroken: 0,
  levelClear: false,
  result: null,
};

// Teclas del juego: se les hace preventDefault para que la página no haga scroll.
const LEFT_KEYS = ["ArrowLeft", "KeyA"];
const RIGHT_KEYS = ["ArrowRight", "KeyD"];
const GAME_KEYS = new Set([...LEFT_KEYS, ...RIGHT_KEYS, "Space"]);
const PAUSE_KEYS = new Set(["KeyP", "Escape"]);
const MUTE_KEY = "KeyM";
const ENTER_KEYS = new Set(["Enter", "NumpadEnter"]);
const NO_INPUT: BloqueBusterInput = {
  left: false,
  right: false,
  mouseX: null,
  action: false,
};

// Sonidos de la referencia, servidos desde public/.
const SOUND_SRC: Record<SoundEvent, string> = {
  bounce: "/games/bloque-buster/sounds/ball-bounce.mp3",
  break: "/games/bloque-buster/sounds/break-sound.mp3",
};

const statsOf = (s: BloqueBusterState): RunStats => ({
  score: s.score,
  lives: s.lives,
  level: s.level,
  bricksBroken: s.bricksBroken,
  levelClear: s.state === "levelclear",
  result:
    s.state === "won" ? "VICTORIA" : s.state === "gameover" ? "DERROTA" : null,
});

const sameStats = (a: RunStats, b: RunStats) =>
  a.score === b.score &&
  a.lives === b.lives &&
  a.level === b.level &&
  a.bricksBroken === b.bricksBroken &&
  a.levelClear === b.levelClear &&
  a.result === b.result;

// ---------------------------------------------------------------------------
// Silencio (av_bloque-buster_muted)
// ---------------------------------------------------------------------------
// Mismo patrón que CAÍDA: useSyncExternalStore con "con sonido" como snapshot
// de servidor, así servidor e hidratación coinciden y readMuted() solo se usa
// en el cliente. El valor de esta sesión se guarda también en memoria: con
// localStorage bloqueado se sigue aplicando y solo deja de persistir.

const muteListeners = new Set<() => void>();
let sessionMuted: boolean | null = null;

function subscribeMuted(listener: () => void) {
  muteListeners.add(listener);
  window.addEventListener("storage", listener); // otras pestañas
  return () => {
    muteListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const mutedSnapshot = () => sessionMuted ?? readMuted();
const serverMutedSnapshot = () => false;

function setMuted(muted: boolean) {
  sessionMuted = muted;
  writeMuted(muted);
  muteListeners.forEach((l) => l());
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// Tras un clic, el botón suelta el foco para que Espacio (lanzar) no lo vuelva a pulsar.
const blurTarget = (ev: MouseEvent<HTMLElement>) => ev.currentTarget.blur();

export function BloqueBusterGame({ game }: PlayableProps) {
  const { user } = useSession();
  const name = user?.name ?? "INVITADO";

  const [phase, setPhase] = useState<Phase>("start");
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const [stats, setStats] = useState<RunStats>(INITIAL_STATS);
  const muted = useSyncExternalStore(
    subscribeMuted,
    mutedSnapshot,
    serverMutedSnapshot,
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);

  // Estado de la partida: sobrevive al ocultarse la ruta (<Activity>), porque
  // la limpieza de los efectos no lo reinicia.
  const engineRef = useRef<BloqueBusterState | null>(null);
  // Copias de estado para los listeners, que leen antes de que React re-renderice.
  const phaseRef = useRef<Phase>(phase);
  const pauseViewRef = useRef<PauseView>(pauseView);
  // Teclas pulsadas ahora mismo. Al reanudar o empezar, las que sigan pulsadas
  // se ignoran hasta soltarlas.
  const pressedRef = useRef(new Set<string>());
  const suppressedRef = useRef(new Set<string>());
  // Acción pendiente para el próximo frame (Espacio o clic: una por pulsación).
  const actionRef = useRef(false);
  // X lógica del cursor desde el último frame, o null si no se movió.
  const mouseXRef = useRef<number | null>(null);
  // Sonidos precargados; se crean en un efecto (solo en el navegador).
  const soundsRef = useRef<Record<SoundEvent, HTMLAudioElement> | null>(null);
  // Copia de `muted` para el bucle.
  const mutedRef = useRef(muted);

  const goTo = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const showPauseView = useCallback((view: PauseView) => {
    pauseViewRef.current = view;
    setPauseView(view);
  }, []);

  // Olvida la entrada pendiente (pulsaciones y ratón) al cambiar de fase.
  const clearPending = useCallback(() => {
    actionRef.current = false;
    mouseXRef.current = null;
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

  // Reproduce y vacía los eventos de sonido del motor. Cada reproducción usa
  // un clon para que se solapen; los rechazos de autoplay se ignoran.
  const playEvents = useCallback(() => {
    const s = engineRef.current;
    if (!s || s.events.length === 0) return;
    const sounds = soundsRef.current;
    if (sounds && !mutedRef.current) {
      for (const ev of s.events) {
        const clip = sounds[ev].cloneNode() as HTMLAudioElement;
        clip.play().catch(() => {});
      }
    }
    s.events.length = 0;
  }, []);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    clearPending();
    showPauseView("main");
    goTo("paused");
  }, [clearPending, goTo, showPauseView]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    suppressedRef.current = new Set(pressedRef.current);
    clearPending();
    goTo("playing");
  }, [clearPending, goTo]);

  // Partida nueva (JUGAR, Enter, Reiniciar, JUGAR DE NUEVO).
  const startRun = useCallback(() => {
    const s = createState(Math.random);
    engineRef.current = s;
    suppressedRef.current = new Set(pressedRef.current);
    clearPending();
    setStats(statsOf(s));
    showPauseView("main");
    goTo("playing");
    draw();
  }, [clearPending, draw, goTo, showPauseView]);

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

  // Nivel superado: CONTINUAR equivale a Espacio (el motor pasa de nivel).
  const continueLevel = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    if (engineRef.current?.state === "levelclear") actionRef.current = true;
  }, []);

  // Precarga de sonidos.
  useEffect(() => {
    soundsRef.current = {
      bounce: new Audio(SOUND_SRC.bounce),
      break: new Audio(SOUND_SRC.break),
    };
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

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

  // Bucle requestAnimationFrame. En "over" sigue sin entrada mientras queden
  // explosiones (isAnimating).
  useEffect(() => {
    if (phase !== "playing" && phase !== "over") return;
    let id = 0;
    let last = performance.now(); // reinicio al montar o reanudar: sin saltos
    const frame = (ts: number) => {
      const s = engineRef.current;
      if (!s) return;
      const dt = Math.min(Math.max((ts - last) / 1000, 0), MAX_DT);
      last = ts;

      const held = (codes: string[]) =>
        codes.some(
          (c) => pressedRef.current.has(c) && !suppressedRef.current.has(c),
        );
      const input: BloqueBusterInput =
        phaseRef.current === "playing"
          ? {
              left: held(LEFT_KEYS),
              right: held(RIGHT_KEYS),
              mouseX: mouseXRef.current,
              action: actionRef.current,
            }
          : NO_INPUT;
      clearPending();

      step(s, dt, input);
      playEvents();
      sync();
      draw();

      if (
        phaseRef.current === "playing" &&
        (s.state === "gameover" || s.state === "won")
      ) {
        goTo("over");
        return; // el efecto de "over" toma el relevo
      }
      if (phaseRef.current === "over" && !isAnimating(s)) return;
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [phase, clearPending, draw, goTo, playEvents, sync]);

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

      // M alterna el sonido en cualquier pantalla menos el modal de fin, donde
      // el teclado es del campo de iniciales.
      if (ev.code === MUTE_KEY && ph !== "over") {
        if (!ev.repeat) setMuted(!mutedRef.current);
        return;
      }

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
      // Una acción por pulsación: la autorrepetición del teclado no cuenta.
      if (ev.code === "Space" && !ev.repeat) actionRef.current = true;
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

  // Ratón sobre el canvas: la X de pantalla se pasa a coordenadas lógicas
  // según el tamaño con el que el CSS muestra el canvas.
  const onCanvasMouseMove = (ev: MouseEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "playing") return;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    mouseXRef.current = ((ev.clientX - rect.left) * W) / rect.width;
  };

  // Clic en el canvas: lanza la pelota, solo durante el saque.
  const onCanvasClick = () => {
    if (phaseRef.current !== "playing") return;
    if (engineRef.current?.state === "serve") actionRef.current = true;
  };

  const inRun = phase === "playing" || phase === "paused";

  return (
    <div className="bloque-buster-root av-player fade-in">
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
            className="bloque-buster-canvas"
            width={W}
            height={H}
            aria-label={`Campo de juego de ${game.title}`}
            role="img"
            onMouseMove={onCanvasMouseMove}
            onClick={onCanvasClick}
          />

          {phase === "start" && (
            <div
              className="bloque-buster-overlay"
              role="dialog"
              aria-labelledby="bloque-buster-start-title"
            >
              <p
                id="bloque-buster-start-title"
                className="bloque-buster-overlay-title"
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
              <p className="bloque-buster-hint">
                o pulsa <kbd>Enter</kbd>
              </p>
            </div>
          )}

          {/* Nivel superado: el canvas dibuja el título; aquí solo CONTINUAR
              y la pista. No se enfoca solo, para que Espacio no lo pulse dos veces. */}
          {phase === "playing" && stats.levelClear && (
            <div className="bloque-buster-continue">
              <button
                className="btn lg pulse"
                onClick={(ev) => {
                  blurTarget(ev);
                  continueLevel();
                }}
              >
                CONTINUAR
              </button>
              <p className="bloque-buster-hint">
                o pulsa <kbd>Espacio</kbd>
              </p>
            </div>
          )}

          {phase === "paused" && (
            <div
              ref={menuRef}
              className="bloque-buster-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="bloque-buster-pause-title"
            >
              <p
                id="bloque-buster-pause-title"
                className="bloque-buster-overlay-title"
              >
                PAUSA
              </p>
              {pauseView === "main" ? (
                <div className="bloque-buster-menu">
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
                <div className="bloque-buster-menu">
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

      <section className="bloque-buster-help" aria-label="Controles">
        <ControlsList />
        <button
          className={`btn ${muted ? "ghost" : ""} bloque-buster-sound`}
          aria-pressed={!muted}
          onClick={(ev) => {
            blurTarget(ev);
            setMuted(!muted);
          }}
        >
          <span className="bloque-buster-led" aria-hidden="true" />
          SONIDO: {muted ? "NO" : "SÍ"}
        </button>
      </section>

      {phase === "over" && (
        <GameOverModal
          game={game}
          score={stats.score}
          ranked
          extra={[
            { label: "Nivel", value: pad2(stats.level) },
            { label: "Ladrillos rotos", value: String(stats.bricksBroken) },
            { label: "Resultado", value: stats.result ?? "DERROTA" },
          ]}
          onRestart={startRun}
        />
      )}
    </div>
  );
}

function ControlsList() {
  return (
    <ul className="bloque-buster-controls">
      <li>
        <span className="keys">
          <kbd>←</kbd>
          <kbd>→</kbd>
          <kbd>A</kbd>
          <kbd>D</kbd>
        </span>
        mover
      </li>
      <li>
        <span className="keys">
          <kbd>Ratón</kbd>
        </span>
        mover · clic lanza
      </li>
      <li>
        <span className="keys">
          <kbd>Espacio</kbd>
        </span>
        lanzar / continuar
      </li>
      <li>
        <span className="keys">
          <kbd>P</kbd>
          <kbd>Esc</kbd>
        </span>
        pausa
      </li>
      <li>
        <span className="keys">
          <kbd>M</kbd>
        </span>
        sonido
      </li>
    </ul>
  );
}
