import { test } from "node:test";
import assert from "node:assert/strict";
import { addLine, unitCents, lineCents, trayCount, trayCents, formatSgd, moneyLeftCents, MAX_QTY } from "./tray.js";

const chickenRice = (quantity = 1, addOns = []) => ({ itemId: 1, stallId: 1, name: "Steamed Chicken Rice", price: 3.5, quantity, addOns });
const egg = { id: 3, name: "Add braised egg", extraPrice: 0.8 };
const lessRice = { id: 2, name: "Less rice", extraPrice: 0 };

test("one portion = dish + its extras, in cents", () => {
  assert.equal(unitCents(chickenRice(1, [egg, lessRice])), 430);
  assert.equal(lineCents(chickenRice(3, [egg])), 3 * 430);
});

test("prices like 0.1 + 0.2 add up exactly (cents, not floats)", () => {
  const line = { itemId: 9, price: 0.1, quantity: 1, addOns: [{ id: 1, extraPrice: 0.2 }] };
  assert.equal(unitCents(line), 30);
});

test("same dish + same extras (any order) merges into one line", () => {
  let lines = addLine([], chickenRice(1, [egg, lessRice]));
  lines = addLine(lines, chickenRice(2, [lessRice, egg]));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 3);
});

test("same dish with different extras stays a separate line", () => {
  let lines = addLine([], chickenRice(1, [egg]));
  lines = addLine(lines, chickenRice(1));
  assert.equal(lines.length, 2);
});

test("quantity never goes above the limit", () => {
  let lines = addLine([], chickenRice(8));
  lines = addLine(lines, chickenRice(5));
  assert.equal(lines[0].quantity, MAX_QTY);
});

test("addLine doesn't change the array it was given", () => {
  const before = addLine([], chickenRice(1));
  const after = addLine(before, chickenRice(1));
  assert.equal(before[0].quantity, 1);
  assert.notEqual(before, after);
});

test("tray count and total", () => {
  const lines = addLine(addLine([], chickenRice(2, [egg])), { itemId: 10, price: 1.8, quantity: 1, addOns: [] });
  assert.equal(trayCount(lines), 3);
  assert.equal(trayCents(lines), 2 * 430 + 180);
  assert.equal(formatSgd(trayCents(lines)), "S$10.40");
});

test("money left counts what's already in the tray (S$5.00 today, S$3.00 in tray -> S$2.00)", () => {
  const tray = addLine([], { itemId: 6, price: 2.5, quantity: 1, addOns: [{ id: 17, extraPrice: 0.5 }] }); // S$3.00
  assert.equal(moneyLeftCents(5, tray), 200);
  // a S$2.50 dish no longer fits, a S$2.00 one still does
  assert.ok(250 > moneyLeftCents(5, tray));
  assert.ok(!(200 > moneyLeftCents(5, tray)));
});

test("money left is never negative, and an empty tray leaves all of it", () => {
  assert.equal(moneyLeftCents(5, []), 500);
  const big = addLine([], { itemId: 25, price: 5.5, quantity: 2, addOns: [] }); // S$11.00
  assert.equal(moneyLeftCents(5, big), 0);
});
