"use client";

import "./duelo-pixel.css";
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
import { TouchControls } from "@/components/touch-controls";
import type { PlayableProps } from "@/games";
import { createTouchInput, type TouchPressEvent } from "@/lib/touch-input";
import {
  createState,
  H,
  MAX_DT,
  RIVALS,
  step,
  W,
  type DueloPixelInput,
  type DueloPixelState,
} from "./core";
import { readSkin, writeSkin } from "./prefs";
import { drawFrame } from "./render";
import {
  DEFAULT_SKIN,
  getSkin,
  isSkinName,
  SKINS,
  type SkinName,
} from "./skins";

// ---------------------------------------------------------------------------
// Estado visible (React) y estado del bucle (refs)
// ---------------------------------------------------------------------------

type Phase = "start" | "playing" | "paused" | "over";
type PauseView = "main" | "controls";
type RunStats = {
  score: number;
  rival: number;
  circuit: number;
  playerPoints: number;
  cpuPoints: number;
  mult: number;
  bestStreak: number;
};

const INITIAL_STATS: RunStats = {
  score: 0,
  rival: 1,
  circuit: 1,
  playerPoints: 0,
  cpuPoints: 0,
  mult: 1,
  bestStreak: 0,
};

// Teclas del juego: se les hace preventDefault para que la página no haga scroll.
const UP_KEYS = ["ArrowUp", "KeyW"];
const DOWN_KEYS = ["ArrowDown", "KeyS"];
const GAME_KEYS = new Set([...UP_KEYS, ...DOWN_KEYS, "Space"]);
const PAUSE_KEYS = new Set(["KeyP", "Escape"]);
const ENTER_KEYS = new Set(["Enter", "NumpadEnter"]);
const NO_INPUT: DueloPixelInput = { up: false, down: false, plasma: false };

const statsOf = (s: DueloPixelState): RunStats => ({
  score: s.score,
  rival: s.rival,
  circuit: s.circuit,
  playerPoints: s.playerPoints,
  cpuPoints: s.cpuPoints,
  mult: s.mult,
  bestStreak: s.bestStreak,
});

const sameStats = (a: RunStats, b: RunStats) =>
  a.score === b.score &&
  a.rival === b.rival &&
  a.circuit === b.circuit &&
  a.playerPoints === b.playerPoints &&
  a.cpuPoints === b.cpuPoints &&
  a.mult === b.mult &&
  a.bestStreak === b.bestStreak;

const pad2 = (n: number) => String(n).padStart(2, "0");
const rivalName = (rival: number) => RIVALS[rival - 1]?.name ?? "";

// ---------------------------------------------------------------------------
// Skin (av_duelo-pixel_skin)
// ---------------------------------------------------------------------------
// Mismo patrón que CAÍDA y BLOQUE BUSTER: DEFAULT_SKIN como snapshot de
// servidor para que la hidratación coincida; readSkin() solo en el cliente.
// El valor de esta sesión manda sobre localStorage (sigue aplicándose aunque
// el almacenamiento esté bloqueado).

const skinListeners = new Set<() => void>();
let sessionSkin: SkinName | null = null;

function subscribeSkin(listener: () => void) {
  skinListeners.add(listener);
  window.addEventListener("storage", listener); // otras pestañas
  return () => {
    skinListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const skinSnapshot = (): SkinName => sessionSkin ?? readSkin();
const serverSkinSnapshot = (): SkinName => DEFAULT_SKIN;

function setSkin(skin: SkinName) {
  if (!isSkinName(skin)) return;
  sessionSkin = skin;
  writeSkin(skin);
  skinListeners.forEach((l) => l());
}

// Controles táctiles (SPEC 12): B no se usa en DUELO PIXEL.
const TOUCH_DISABLED = { b: true } as const;

// Tras un clic, el botón suelta el foco para que Espacio (plasma) no lo vuelva a pulsar.
const blurTarget = (ev: MouseEvent<HTMLElement>) => ev.currentTarget.blur();

export function DueloPixelGame({ game }: PlayableProps) {
  const { user } = useSession();
  const name = user?.name ?? "INVITADO";

  const [phase, setPhase] = useState<Phase>("start");
  const [pauseView, setPauseView] = useState<PauseView>("main");
  const [stats, setStats] = useState<RunStats>(INITIAL_STATS);
  const skin = useSyncExternalStore(
    subscribeSkin,
    skinSnapshot,
    serverSkinSnapshot,
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const resumeBtnRef = useRef<HTMLButtonElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);

  // Estado de la partida: sobrevive al ocultarse la ruta (<Activity>), porque
  // la limpieza de los efectos no lo reinicia.
  const engineRef = useRef<DueloPixelState | null>(null);
  // Copias de estado para los listeners, que leen antes de que React re-renderice.
  const phaseRef = useRef<Phase>(phase);
  const pauseViewRef = useRef<PauseView>(pauseView);
  // Teclas pulsadas ahora mismo. Al reanudar o empezar, las que sigan pulsadas
  // se ignoran hasta soltarlas.
  const pressedRef = useRef(new Set<string>());
  const suppressedRef = useRef(new Set<string>());
  // Plasma pendiente para el próximo frame (una vez por pulsación de Espacio).
  const plasmaRef = useRef(false);
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

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    plasmaRef.current = false;
    showPauseView("main");
    goTo("paused");
  }, [goTo, showPauseView]);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    suppressedRef.current = new Set(pressedRef.current);
    plasmaRef.current = false;
    goTo("playing");
  }, [goTo]);

  // Partida nueva (JUGAR, Enter, Reiniciar, JUGAR DE NUEVO).
  const startRun = useCallback(() => {
    const s = createState(Math.random);
    engineRef.current = s;
    suppressedRef.current = new Set(pressedRef.current);
    plasmaRef.current = false;
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

  // Bucle requestAnimationFrame: solo en "playing".
  useEffect(() => {
    if (phase !== "playing") return;
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
      const input: DueloPixelInput =
        phaseRef.current === "playing"
          ? {
              // Teclado o D-pad táctil (OR).
              up: held(UP_KEYS) || touch.state.up,
              down: held(DOWN_KEYS) || touch.state.down,
              plasma: plasmaRef.current,
            }
          : NO_INPUT;
      plasmaRef.current = false;

      step(s, dt, input);
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
  }, [phase, draw, goTo, sync, touch]);

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
      // no mueven la paleta ni cuentan como teclas pulsadas. P / Esc siguen
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
      // Una acción por pulsación: la autorrepetición del teclado no cuenta.
      if (ev.code === "Space" && !ev.repeat) plasmaRef.current = true;
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

  // Botón A táctil: un golpe de plasma por toque, como Espacio sin
  // autorrepetición. ↑ / ↓ se leen del estado en el bucle.
  const onTouchPress = useCallback((ev: TouchPressEvent) => {
    if (phaseRef.current !== "playing" || ev.repeated) return;
    if (ev.button === "a") plasmaRef.current = true;
  }, []);

  const inRun = phase === "playing" || phase === "paused";

  return (
    <div className="duelo-pixel-root av-player fade-in" data-skin={skin}>
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
          <div className="hud-stat">
            <div className="l">Rival</div>
            <div className="v">
              {pad2(stats.rival)}/{pad2(RIVALS.length)}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Set</div>
            <div
              className="v"
              aria-label={`${stats.playerPoints} a ${stats.cpuPoints}`}
            >
              {stats.playerPoints}–{stats.cpuPoints}
            </div>
          </div>
          <div className="hud-stat streak">
            <div className="l">Racha</div>
            <div className="v">x{stats.mult}</div>
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
            className="duelo-pixel-canvas"
            width={W}
            height={H}
            aria-label={`Campo de juego de ${game.title}`}
            role="img"
          />

          {phase === "start" && (
            <div
              className="duelo-pixel-overlay"
              role="dialog"
              aria-labelledby="duelo-pixel-start-title"
            >
              <p
                id="duelo-pixel-start-title"
                className="duelo-pixel-overlay-title"
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
              <p className="duelo-pixel-hint">
                o pulsa <kbd>Enter</kbd>
              </p>
            </div>
          )}

          {phase === "paused" && (
            <div
              ref={menuRef}
              className="duelo-pixel-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="duelo-pixel-pause-title"
            >
              <p
                id="duelo-pixel-pause-title"
                className="duelo-pixel-overlay-title"
              >
                PAUSA
              </p>
              {pauseView === "main" ? (
                <div className="duelo-pixel-menu">
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
                <div className="duelo-pixel-menu">
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
          <span>
            CIRCUITO {pad2(stats.circuit)} · {rivalName(stats.rival)}
          </span>
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

      <section className="duelo-pixel-help" aria-label="Controles">
        <ControlsList />
        <div className="duelo-pixel-skin">
          <label className="duelo-pixel-label" htmlFor="duelo-pixel-skin">
            Skin
          </label>
          <select
            id="duelo-pixel-skin"
            className="duelo-pixel-select"
            value={skin}
            onChange={(ev) => {
              setSkin(ev.target.value as SkinName);
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
      </section>

      {phase === "over" && (
        <GameOverModal
          game={game}
          score={stats.score}
          ranked
          extra={[
            {
              label: "Rival",
              value: `${pad2(stats.rival)} · ${rivalName(stats.rival)}`,
            },
            { label: "Circuito", value: pad2(stats.circuit) },
            { label: "Mejor racha", value: String(stats.bestStreak) },
          ]}
          onRestart={startRun}
        />
      )}
    </div>
  );
}

function ControlsList() {
  return (
    <ul className="duelo-pixel-controls">
      <li>
        <span className="keys">
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          <kbd>W</kbd>
          <kbd>S</kbd>
        </span>
        mover
      </li>
      <li>
        <span className="keys">
          <kbd>Espacio</kbd>
        </span>
        golpe de plasma
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
