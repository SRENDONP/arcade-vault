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

/**
 * setPointerCapture lanza NotFoundError si el puntero ya no está activo (p. ej.
 * se levantó antes de que llegara el evento, o un PointerEvent sintético de una
 * prueba). Sin captura el control sigue funcionando con pointerup/cancel.
 */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // sin captura
  }
}

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
  const pauseBtnRef = useRef<HTMLButtonElement>(null);
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

  // Liberación segura: foco de la ventana, página oculta y desmontaje
  // (incluido el ocultarse la ruta dentro de <Activity>).
  useEffect(() => {
    const onBlur = () => releaseEverything();
    const onVisibility = () => {
      if (document.hidden) releaseEverything();
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      releaseEverything();
    };
  }, [releaseEverything]);

  // --- A y B: un puntero por botón ------------------------------------------

  const onButtonDown = (ev: PointerEvent<HTMLButtonElement>) => {
    const button = ev.currentTarget.dataset.button as TouchButton;
    const p = propsRef.current;
    if (!p.active || p.disabled?.[button]) return;
    ev.preventDefault();
    capture(ev.currentTarget, ev.pointerId);
    pointersRef.current.set(ev.pointerId, button);
    press(button);
  };

  // pointerup, pointercancel y lostpointercapture: suelta el botón de ese dedo
  // si ningún otro dedo lo sigue sujetando.
  const onButtonEnd = (ev: PointerEvent<HTMLButtonElement>) => {
    const pointers = pointersRef.current;
    const button = pointers.get(ev.pointerId);
    if (button === undefined) return;
    pointers.delete(ev.pointerId);
    for (const other of pointers.values()) if (other === button) return;
    release(button);
  };

  // --- D-pad: una zona que sigue al dedo --------------------------------------

  // Pasa de las flechas sujetas a las del punto (x, y): primero suelta las que
  // sobran y luego pulsa las nuevas (en una diagonal, solo emite la nueva).
  const aimDpad = (x: number, y: number) => {
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
  };

  const onDpadDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (!propsRef.current.active || dpadPointerRef.current !== null) return;
    ev.preventDefault();
    capture(ev.currentTarget, ev.pointerId);
    const box = ev.currentTarget.getBoundingClientRect();
    dpadPointerRef.current = ev.pointerId;
    dpadRectRef.current = {
      cx: box.left + box.width / 2,
      cy: box.top + box.height / 2,
      radius: Math.min(box.width, box.height) / 2,
    };
    aimDpad(ev.clientX, ev.clientY);
  };

  const onDpadMove = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.pointerId !== dpadPointerRef.current) return;
    if (!propsRef.current.active) return;
    aimDpad(ev.clientX, ev.clientY);
  };

  // pointerup, pointercancel y lostpointercapture del dedo del D-pad.
  const onDpadEnd = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.pointerId !== dpadPointerRef.current) return;
    dpadPointerRef.current = null;
    dpadRectRef.current = null;
    const held = dpadHeldRef.current;
    for (const arrow of [...held]) {
      held.delete(arrow);
      release(arrow);
    }
  };

  // --- Pausa: usa pause()/resume() del juego vía onPauseToggle ---------------

  const onPauseDown = (ev: PointerEvent<HTMLButtonElement>) => {
    if (!propsRef.current.pauseEnabled) return;
    capture(ev.currentTarget, ev.pointerId);
    ev.currentTarget.setAttribute("data-pressed", "");
  };
  const onPauseEnd = (ev: PointerEvent<HTMLButtonElement>) => {
    ev.currentTarget.removeAttribute("data-pressed");
  };
  const onPauseClick = (ev: MouseEvent<HTMLButtonElement>) => {
    // Suelta el foco para que Espacio / Enter no vuelvan a pulsarlo.
    ev.currentTarget.blur();
    if (!propsRef.current.pauseEnabled) return;
    propsRef.current.onPauseToggle();
  };

  return (
    <div
      className="touch-controls"
      data-active={active ? "true" : "false"}
      onContextMenu={(ev) => ev.preventDefault()}
    >
      <div
        className="tc-dpad"
        role="group"
        aria-label="Cruceta"
        onPointerDown={onDpadDown}
        onPointerMove={onDpadMove}
        onPointerUp={onDpadEnd}
        onPointerCancel={onDpadEnd}
        onLostPointerCapture={onDpadEnd}
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
        onPointerUp={onPauseEnd}
        onPointerCancel={onPauseEnd}
        onLostPointerCapture={onPauseEnd}
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
            onPointerUp={onButtonEnd}
            onPointerCancel={onButtonEnd}
            onLostPointerCapture={onButtonEnd}
          >
            {button.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
