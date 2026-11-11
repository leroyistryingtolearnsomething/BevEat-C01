import { test } from "node:test";
import assert from "node:assert/strict";
import { progressFromDrag, isComplete, keyStep, COMPLETE_AT, KEY_STEP } from "./slideToPay.js";

const MAX = 300; // px the thumb can travel

test("a drag is turned into 0..1 of the way across", () => {
  assert.equal(progressFromDrag(100, 100, MAX), 0);
  assert.equal(progressFromDrag(100, 250, MAX), 0.5);
  assert.equal(progressFromDrag(100, 400, MAX), 1);
});

test("dragging past either end stays at 0 or 1", () => {
  assert.equal(progressFromDrag(100, 20, MAX), 0);
  assert.equal(progressFromDrag(100, 900, MAX), 1);
});

test("a track that isn't laid out yet (width 0) never counts as slid all the way", () => {
  assert.equal(progressFromDrag(0, 50, 0), 0);
  assert.equal(isComplete(progressFromDrag(0, 50, 0)), false);
});

test("89% springs back, 90% pays", () => {
  assert.equal(COMPLETE_AT, 0.9);
  assert.equal(isComplete(progressFromDrag(0, 0.89 * MAX, MAX)), false);
  assert.equal(isComplete(progressFromDrag(0, 0.9 * MAX, MAX)), true);
  assert.equal(isComplete(1), true);
});

test("4 presses of → reach the end and pay", () => {
  let p = 0;
  for (let i = 0; i < 3; i++) p = keyStep(p, "ArrowRight");
  assert.equal(p, 3 * KEY_STEP);
  assert.equal(isComplete(p), false, "3 presses is not enough");
  p = keyStep(p, "ArrowRight");
  assert.equal(p, 1);
  assert.equal(isComplete(p), true);
  assert.equal(keyStep(1, "ArrowRight"), 1, "never past the end");
});

test("← steps back, Home goes to the start, End to the end", () => {
  assert.equal(keyStep(0.5, "ArrowLeft"), 0.25);
  assert.equal(keyStep(0, "ArrowLeft"), 0, "never before the start");
  assert.equal(keyStep(0.75, "Home"), 0);
  assert.equal(keyStep(0, "End"), 1);
});

test("other keys are left alone (null), e.g. Tab", () => {
  assert.equal(keyStep(0.5, "Tab"), null);
  assert.equal(keyStep(0.5, "a"), null);
});
