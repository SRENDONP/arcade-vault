"use client";

// Controles táctiles reutilizables (SPEC 12): D-pad, botones A y B y pausa.
// No conoce ningún juego: escribe `input.state` y avisa con onPress/onRelease;
// cada juego traduce eso a sus acciones. Solo se ve en dispositivos táctiles
// (CSS en app/globals.css). Nada de games/ se importa aquí.

import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  TOUCH_BUTTONS,
  releaseAll,
  type TouchButton,
  type TouchInput,
  type TouchPressEvent,
  type TouchRepeat,
} from "@/lib/touch-input";

export type TouchControlsProps = {
  input: TouchInput; // el juego lo crea con useRef(createTouchInput())
  active: boolean; // false → suelta todo y no emite eventos
  disabled?: Partial<Record<TouchButton, boolean>>; // atenuados (p. ej. { a: true, b: true })
  repeat?: Partial<Record<TouchButton, TouchRepeat>>;
  onPress?: (ev: TouchPressEvent) => void;
  onRelease?: (button: TouchButton) => void;
  paused: boolean; // icono del botón de pausa
  pauseEnabled: boolean;
  onPauseToggle: () => void; // el juego pasa paused ? resume : pause
};

const AB_BUTTONS = ["b", "a"] as const; // B a la izquierda, A a la derecha
const AB_LABEL: Record<(typeof AB_BUTTONS)[number], string> = {
  a: "Botón A",
  b: "Botón B",
};

// --- D-pad -------------------------------------------------------------------

type Arrow = "up" | "down" | "left" | "right";
const ARROWS: readonly Arrow[] = ["up", "left", "right", "down"]; // orden visual
const ARROW_GLYPH: Record<Arrow, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};

/** Zona muerta central: fracción del radio del D-pad sin ninguna flecha. */
const DEAD_ZONE = 0.25;

/**
 * 8 sectores de 45°, centrados en cada dirección. Índice = round(ángulo / 45°),
 * con el ángulo de atan2 en pantalla (y hacia abajo): 0 = derecha, 2 = abajo…
 */
const SECTORS: readonly (readonly Arrow[])[] = [
  ["right"],
  ["right", "down"],
  ["down"],
  ["down", "left"],
  ["left"],
  ["left", "up"],
  ["up"],
  ["up", "right"],
];

type DpadRect = { cx: number; cy: number; radius: number };

/** Flechas activas para un punto de pantalla, según el centro del D-pad. */
function arrowsAt(rect: DpadRect, x: number, y: number): readonly Arrow[] {
  const dx = x - rect.cx;
  const dy = y - rect.cy;
  if (Math.hypot(dx, dy) < rect.radius * DEAD_ZONE) return [];
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return SECTORS[(sector + 8) % 8];
}

export function TouchControls(props: TouchControlsProps) {
  const { active, disabled, paused, pauseEnabled } = props;

  // Props vigentes para listeners y temporizadores, que leen fuera del render.
  const propsRef = useRef(props);
  // Elementos que pintan data-pressed: A, B y cada flecha del D-pad.
  const elsRef = useRef<Partial<Record<TouchButton, HTMLElement | null>>>({});
  // pointerId → botón (A/B) que sujeta ese dedo.
  const pointersRef = useRef(new Map<number, TouchButton>());
  // Temporizador de repetición activo por botón (timeout y luego interval).
  const timersRef = useRef(new Map<TouchButton, number>());
  const rootRef = useRef<HTMLDivElement>(null);
  const pauseBtnRef = useRef<HTMLButtonElement>(null);
  // Dedo que está pulsando el botón de pausa (se confirma al levantarlo).
  const pausePointerRef = useRef<number | null>(null);
  // D-pad: un solo dedo a la vez, con la geometría medida en su pointerdown
  // (sin cachear entre toques, por <Activity> y los giros de pantalla).
  const dpadPointerRef = useRef<number | null>(null);
  const dpadRectRef = useRef<DpadRect | null>(null);
  const dpadHeldRef = useRef(new Set<Arrow>());

  useEffect(() => {
    propsRef.current = props;
  });

  // El estado visual sale siempre de input.state, sin re-render de React.
  const paint = useCallback(() => {
    const { state } = propsRef.current.input;
    for (const button of TOUCH_BUTTONS) {
      elsRef.current[button]?.toggleAttribute("data-pressed", state[button]);
    }
  }, []);

  const stopRepeat = useCallback((button: TouchButton) => {
    const id = timersRef.current.get(button);
    if (id === undefined) return;
    window.clearTimeout(id);
    window.clearInterval(id);
    timersRef.current.delete(button);
  }, []);

  const press = useCallback(
    (button: TouchButton) => {
      const p = propsRef.current;
      if (p.input.state[button]) return;
      p.input.state[button] = true;
      paint();
      p.onPress?.({ button, repeated: false });

      const rep = p.repeat?.[button];
      if (!rep) return;
      const tick = () => {
        const cur = propsRef.current;
        if (!cur.active || !cur.input.state[button]) return;
        cur.onPress?.({ button, repeated: true });
      };
      timersRef.current.set(
        button,
        window.setTimeout(() => {
          tick();
          timersRef.current.set(button, window.setInterval(tick, rep.interval));
        }, rep.delay),
      );
    },
    [paint],
  );

  const release = useCallback(
    (button: TouchButton) => {
      stopRepeat(button);
      const p = propsRef.current;
      if (!p.input.state[button]) return;
      p.input.state[button] = false;
      paint();
      p.onRelease?.(button);
    },
    [paint, stopRepeat],
  );

  const releaseEverything = useCallback(() => {
    pointersRef.current.clear();
    dpadPointerRef.current = null;
    dpadRectRef.current = null;
    dpadHeldRef.current.clear();
    pausePointerRef.current = null;
    for (const button of [...timersRef.current.keys()]) stopRepeat(button);
    const released = releaseAll(propsRef.current.input);
    paint();
    pauseBtnRef.current?.removeAttribute("data-pressed");
    for (const button of released) propsRef.current.onRelease?.(button);
  }, [paint, stopRepeat]);

  // Fuera de partida (o en pausa) no queda nada pulsado.
  useEffect(() => {
    if (!active) releaseEverything();
  }, [active, releaseEverything]);

  // Un botón que pasa a deshabilitado se suelta si estaba pulsado.
  const disabledKey = TOUCH_BUTTONS.filter((b) => disabled?.[b]).join(",");
  useEffect(() => {
    if (!disabledKey) return;
    for (const button of disabledKey.split(",") as TouchButton[]) {
      release(button);
    }
  }, [disabledKey, release]);

  // --- Seguimiento de los dedos ----------------------------------------------
  //
  // Safari en iOS no es fiable con setPointerCapture / lostpointercapture en
  // toques: al mover la captura implícita (de la flecha al D-pad, o al propio
  // botón) dispara un lostpointercapture que soltaba el control en el mismo
  // toque, y nada respondía. Por eso no se captura: cada control solo escucha
  // su pointerdown y el resto (move, up, cancel) se sigue en window por
  // pointerId, llegue donde llegue el dedo.

  // Suelta lo que sujetaba un dedo (pointerup o pointercancel en window).
  const endPointer = useCallback(
    (pointerId: number, x: number, y: number, cancelled: boolean) => {
      // A / B: se suelta si ningún otro dedo sigue en el mismo botón.
      const pointers = pointersRef.current;
      const button = pointers.get(pointerId);
      if (button !== undefined) {
        pointers.delete(pointerId);
        if (![...pointers.values()].includes(button)) release(button);
      }

      // D-pad
      if (pointerId === dpadPointerRef.current) {
        dpadPointerRef.current = null;
        dpadRectRef.current = null;
        const held = dpadHeldRef.current;
        for (const arrow of [...held]) {
          held.delete(arrow);
          release(arrow);
        }
      }

      // Pausa: se confirma al levantar el dedo encima del botón.
      if (pointerId === pausePointerRef.current) {
        pausePointerRef.current = null;
        const el = pauseBtnRef.current;
        el?.removeAttribute("data-pressed");
        if (cancelled || !el) return;
        const r = el.getBoundingClientRect();
        const inside =
          x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        if (inside && propsRef.current.pauseEnabled) {
          propsRef.current.onPauseToggle();
        }
      }
    },
    [release],
  );

  // Pasa de las flechas sujetas a las del punto (x, y): primero suelta las que
  // sobran y luego pulsa las nuevas (en una diagonal, solo emite la nueva).
  const aimDpad = useCallback(
    (x: number, y: number) => {
      const rect = dpadRectRef.current;
      if (!rect) return;
      const { disabled: off } = propsRef.current;
      const next = new Set(arrowsAt(rect, x, y).filter((a) => !off?.[a]));
      const held = dpadHeldRef.current;
      for (const arrow of [...held]) {
        if (next.has(arrow)) continue;
        held.delete(arrow);
        release(arrow);
      }
      for (const arrow of next) {
        if (held.has(arrow)) continue;
        held.add(arrow);
        press(arrow);
      }
    },
    [press, release],
  );

  // Dedos que se mueven o se levantan en cualquier sitio, y liberación segura:
  // foco de la ventana, página oculta y desmontaje (incluido el ocultarse la
  // ruta dentro de <Activity>).
  useEffect(() => {
    const onMove = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== dpadPointerRef.current) return;
      if (!propsRef.current.active) return;
      aimDpad(ev.clientX, ev.clientY);
    };
    const onUp = (ev: globalThis.PointerEvent) =>
      endPointer(ev.pointerId, ev.clientX, ev.clientY, false);
    const onCancel = (ev: globalThis.PointerEvent) =>
      endPointer(ev.pointerId, ev.clientX, ev.clientY, true);
    const onBlur = () => releaseEverything();
    const onVisibility = () => {
      if (document.hidden) releaseEverything();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      releaseEverything();
    };
  }, [aimDpad, endPointer, releaseEverything]);

  // iOS: touch-action no basta para que Safari no convierta el toque en
  // scroll, zoom por doble toque, lupa o selección (todo acaba en
  // pointercancel). Un touchstart / touchmove / touchend no pasivo con
  // preventDefault lo impide. Como eso también suprime el click sintético, la
  // pausa se confirma en pointerup (endPointer) y onClick solo es del teclado.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const block = (ev: Event) => {
      if (ev.cancelable) ev.preventDefault();
    };
    const opts: AddEventListenerOptions = { passive: false };
    const types = ["touchstart", "touchmove", "touchend", "gesturestart"];
    for (const type of types) root.addEventListener(type, block, opts);
    return () => {
      for (const type of types) root.removeEventListener(type, block, opts);
    };
  }, []);

  // --- A y B: un puntero por botón ------------------------------------------

  const onButtonDown = (ev: PointerEvent<HTMLButtonElement>) => {
    const button = ev.currentTarget.dataset.button as TouchButton;
    const p = propsRef.current;
    if (!p.active || p.disabled?.[button]) return;
    ev.preventDefault();
    pointersRef.current.set(ev.pointerId, button);
    press(button);
  };

  // --- D-pad: una zona que sigue al dedo --------------------------------------

  const onDpadDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (!propsRef.current.active || dpadPointerRef.current !== null) return;
    ev.preventDefault();
    const box = ev.currentTarget.getBoundingClientRect();
    dpadPointerRef.current = ev.pointerId;
    dpadRectRef.current = {
      cx: box.left + box.width / 2,
      cy: box.top + box.height / 2,
      radius: Math.min(box.width, box.height) / 2,
    };
    aimDpad(ev.clientX, ev.clientY);
  };

  // --- Pausa: usa pause()/resume() del juego vía onPauseToggle ---------------

  const onPauseDown = (ev: PointerEvent<HTMLButtonElement>) => {
    if (!propsRef.current.pauseEnabled) return;
    ev.preventDefault();
    pausePointerRef.current = ev.pointerId;
    ev.currentTarget.setAttribute("data-pressed", "");
  };
  const onPauseClick = (ev: MouseEvent<HTMLButtonElement>) => {
    // Suelta el foco para que Espacio / Enter no vuelvan a pulsarlo.
    ev.currentTarget.blur();
    // Toque y ratón ya se confirmaron en pointerup; aquí solo el teclado
    // (detail === 0), para no pausar y reanudar con el mismo toque.
    if (ev.detail !== 0) return;
    if (!propsRef.current.pauseEnabled) return;
    propsRef.current.onPauseToggle();
  };

  return (
    <div
      ref={rootRef}
      className="touch-controls"
      data-active={active ? "true" : "false"}
      onContextMenu={(ev) => ev.preventDefault()}
    >
      <div
        className="tc-dpad"
        role="group"
        aria-label="Cruceta"
        onPointerDown={onDpadDown}
      >
        {ARROWS.map((arrow) => (
          <span
            key={arrow}
            ref={(el) => {
              elsRef.current[arrow] = el;
            }}
            className={`tc-arrow tc-${arrow}`}
            aria-hidden="true"
            data-disabled={disabled?.[arrow] ? "true" : undefined}
          >
            {ARROW_GLYPH[arrow]}
          </span>
        ))}
      </div>

      <button
        ref={pauseBtnRef}
        type="button"
        className="tc-pause"
        aria-label={paused ? "Reanudar" : "Pausa"}
        aria-disabled={!pauseEnabled}
        onPointerDown={onPauseDown}
        onClick={onPauseClick}
      >
        {paused ? "▶" : "❚❚"}
      </button>

      <div className="tc-ab">
        {AB_BUTTONS.map((button) => (
          <button
            key={button}
            ref={(el) => {
              elsRef.current[button] = el;
            }}
            type="button"
            tabIndex={-1}
            className={`tc-btn tc-${button}`}
            data-button={button}
            aria-label={AB_LABEL[button]}
            aria-disabled={Boolean(disabled?.[button])}
            onPointerDown={onButtonDown}
          >
            {button.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
