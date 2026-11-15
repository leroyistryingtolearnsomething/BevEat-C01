import { test } from "node:test";
import assert from "node:assert/strict";
import { filterDays, sumUp } from "./spendFilter.js";

const day = (date, day, spent, limit = 5) => ({ date, day, spent, limit, overLimit: spent > limit });
const days = [
  day("2026-11-10", "tue", 3),
  day("2026-11-11", "wed", 6),
  day("2026-11-12", "thu", 2.5),
  day("2026-11-13", "fri", 4),
  day("2026-11-14", "sat", 0),
  day("2026-11-15", "sun", 1),
];

test("no filter keeps every day", () => {
  assert.equal(filterDays(days).length, 6);
});

test("date range includes both ends", () => {
  const got = filterDays(days, { from: "2026-11-11", to: "2026-11-13" });
  assert.deepEqual(got.map((d) => d.date), ["2026-11-11", "2026-11-12", "2026-11-13"]);
});

test("only the picked weekdays", () => {
  const got = filterDays(days, { weekdays: ["sat", "sun"] });
  assert.deepEqual(got.map((d) => d.day), ["sat", "sun"]);
});

test("range and weekdays together", () => {
  const got = filterDays(days, { from: "2026-11-12", weekdays: ["wed", "thu", "fri"] });
  assert.deepEqual(got.map((d) => d.day), ["thu", "fri"]);
});

test("totals are worked out again for the filtered days", () => {
  const s = sumUp(filterDays(days, { from: "2026-11-11", to: "2026-11-12" }));
  assert.deepEqual(s, { total: 8.5, averagePerDay: 4.25, daysOverLimit: 1, usedPct: 85 });
});

test("nothing left after filtering gives zeros, not NaN", () => {
  assert.deepEqual(sumUp([]), { total: 0, averagePerDay: 0, daysOverLimit: 0, usedPct: 0 });
});
