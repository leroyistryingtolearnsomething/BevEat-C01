// The maths behind 06 "Slide to pay", kept out of the React component so it can be tested on
// its own. Progress is a number from 0 (thumb at the start) to 1 (thumb at the end).

// Paying needs a real, deliberate slide, not a bump: 90% of the way, not just "past halfway"
export const COMPLETE_AT = 0.9;

// Each arrow key press moves the thumb a quarter of the way, so 4 presses pay
export const KEY_STEP = 0.25;

const clamp01 = (n) => Math.min(Math.max(n, 0), 1);

// startX = where the finger would be if the thumb were at 0, x = where the finger is now,
// maxX = how far the thumb can travel (in px). Dragging past either end stays at 0 or 1.
export function progressFromDrag(startX, x, maxX) {
  if (!(maxX > 0)) return 0; // track not laid out yet: never treat that as "slid all the way"
  return clamp01((x - startX) / maxX);
}

export const isComplete = (progress) => progress >= COMPLETE_AT;

// Where a key moves the thumb, or null if the slider doesn't use that key
// (so the page keeps its normal behaviour for it, e.g. Tab).
export function keyStep(progress, key) {
  if (key === "ArrowRight" || key === "ArrowUp") return clamp01(progress + KEY_STEP);
  if (key === "ArrowLeft" || key === "ArrowDown") return clamp01(progress - KEY_STEP);
  if (key === "Home") return 0;
  if (key === "End") return 1;
  return null;
}
