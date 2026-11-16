import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addLine, unitCents, lineCents, trayCount, trayBadge, trayCents, formatSgd, moneyLeftCents, MAX_QTY,
  lineKey, setQuantity, removeLine, restoreLine, toQuoteItems, lineSubtitle, linesInStallOrder, problemsByKey, problemMessage,
} from "./tray.js";

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
  assert.equal(formatSgd(trayCents(lines)), "$10.40");
});

test("money left counts what's already in the tray ($5.00 today, $3.00 in tray -> $2.00)", () => {
  const tray = addLine([], { itemId: 6, price: 2.5, quantity: 1, addOns: [{ id: 17, extraPrice: 0.5 }] }); // $3.00
  assert.equal(moneyLeftCents(5, tray), 200);
  // a $2.50 dish no longer fits, a $2.00 one still does
  assert.ok(250 > moneyLeftCents(5, tray));
  assert.ok(!(200 > moneyLeftCents(5, tray)));
});

test("money left is never negative, and an empty tray leaves all of it", () => {
  assert.equal(moneyLeftCents(5, []), 500);
  const big = addLine([], { itemId: 25, price: 5.5, quantity: 2, addOns: [] }); // $11.00
  assert.equal(moneyLeftCents(5, big), 0);
});

// ---------- 06 My tray ----------

const rice = { itemId: 1, stallId: 1, stallName: "Lim's Chicken Rice", name: "Steamed Chicken Rice", price: 3.5, quantity: 1, addOns: [lessRice, egg] };
const milo = { itemId: 10, stallId: 4, stallName: "Wong's Drinks & Desserts", name: "Milo Ice", price: 1.8, quantity: 2, addOns: [] };
const roast = { itemId: 2, stallId: 1, stallName: "Lim's Chicken Rice", name: "Roasted Chicken Rice", price: 3.8, quantity: 1, addOns: [] };

test("stepper: + and - change only that line, and never go over the limit", () => {
  const tray = [rice, milo];
  assert.equal(setQuantity(tray, 1, 3)[1].quantity, 3);
  assert.equal(setQuantity(tray, 1, 3)[0], rice);
  assert.equal(setQuantity(tray, 0, MAX_QTY + 1)[0].quantity, MAX_QTY);
  assert.equal(tray[1].quantity, 2); // the old tray isn't changed
});

test("stepper to 0 takes the line out", () => {
  assert.deepEqual(setQuantity([rice, milo], 0, 0), [milo]);
});

test("undo puts a removed line back in the same spot", () => {
  const tray = [rice, milo, roast];
  const { lines, removed } = removeLine(tray, 1);
  assert.deepEqual(lines, [rice, roast]);
  assert.deepEqual(restoreLine(lines, removed), tray);
});

test("undo still works if the tray got shorter in the meantime", () => {
  const { removed } = removeLine([rice, milo, roast], 2);
  assert.deepEqual(restoreLine([rice], removed), [rice, roast]);
});

test("the quote request has ids and quantities only, never a price or name", () => {
  const items = toQuoteItems([{ ...rice, price: 0.01, total: 0 }]);
  assert.deepEqual(items, [{ itemId: 1, quantity: 1, addOnIds: [2, 3] }]);
  assert.ok(!JSON.stringify(items).includes("price") && !JSON.stringify(items).includes("name"));
});

test("subtitle = extras, then the stall (Figma: 'Less sugar · Uncle Lim')", () => {
  assert.equal(lineSubtitle(rice), "Less rice, Add braised egg · Lim's Chicken Rice");
  assert.equal(lineSubtitle(milo), "Wong's Drinks & Desserts");
});

test("rows are grouped by stall, in the order the stalls were added, keeping each tray index", () => {
  const rows = linesInStallOrder([rice, milo, roast]);
  assert.deepEqual(rows.map((r) => r.index), [0, 2, 1]);
  assert.equal(rows[2].line, milo);
});

test("a tray line and its priced server line get the same key", () => {
  const serverLine = { itemId: 1, addOns: [{ id: 3, name: "Add braised egg", extraPrice: 0.8 }, { id: 2, name: "Less rice", extraPrice: 0 }] };
  assert.equal(lineKey(rice), lineKey(serverLine));
  assert.notEqual(lineKey(rice), lineKey(roast));
});

test("a 409 problem stays on the right dish after another line is removed", () => {
  const sent = [rice, milo, roast];
  const problems = problemsByKey(sent, [{ lineIndex: 1, itemId: 10, addOnId: null, name: "Milo Ice", reason: "sold_out" }]);
  const afterRemovingRice = removeLine(sent, 0).lines; // Milo is now line 0
  assert.equal(problems.get(lineKey(afterRemovingRice[0])).reason, "sold_out");
  assert.equal(problems.get(lineKey(roast)), undefined);
});

test("every problem reason has kid-friendly words", () => {
  assert.equal(problemMessage({ reason: "allergy", addOnId: null }), "Not safe for you");
  assert.equal(problemMessage({ reason: "allergy", addOnId: 3, name: "Add braised egg" }), "Add braised egg isn't safe for you");
  assert.equal(problemMessage({ reason: "parent_rule" }), "Mum says not today");
  assert.equal(problemMessage({ reason: "sold_out" }), "Sold out now");
  assert.equal(problemMessage({ reason: "stall_closed" }), "This stall just closed");
  assert.equal(problemMessage({ reason: "something_new" }), "Can't order this now");
});

test("Home cart badge: none when empty, the item count, 9+ past 9", () => {
  assert.equal(trayBadge([]), null);
  assert.equal(trayBadge([chickenRice(2), { ...chickenRice(1), itemId: 2 }]), "3", "counts portions, not lines");
  assert.equal(trayBadge([chickenRice(9)]), "9");
  assert.equal(trayBadge([chickenRice(10)]), "9+");
});
