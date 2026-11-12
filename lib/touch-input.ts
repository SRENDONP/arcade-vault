// Touch input state shared by components/touch-controls.tsx (writer) and each
// game's loop (reader). Pure: no React, no DOM, nothing from games/ (SPEC 12).

export type TouchButton = "up" | "down" | "left" | "right" | "a" | "b";

/** Every control, in a fixed order (D-pad first, then A and B). */
export const TOUCH_BUTTONS: readonly TouchButton[] = [
  "up",
  "down",
  "left",
  "right",
  "a",
  "b",
];

/** Current state: true while the control is held down. */
export type TouchInputState = Record<TouchButton, boolean>;

export type TouchRepeat = { delay: number; interval: number }; // ms

export type TouchPressEvent = { button: TouchButton; repeated: boolean };

export type TouchInput = {
  state: TouchInputState; // mutable object, read by the game loops
};

/** A fresh input with every control released. */
export function createTouchInput(): TouchInput {
  return {
    state: {
      up: false,
      down: false,
      left: false,
      right: false,
      a: false,
      b: false,
    },
  };
}

/** Releases every control and returns the ones that were held down. */
export function releaseAll(input: TouchInput): TouchButton[] {
  const released: TouchButton[] = [];
  for (const button of TOUCH_BUTTONS) {
    if (input.state[button]) {
      input.state[button] = false;
      released.push(button);
    }
  }
  return released;
}
