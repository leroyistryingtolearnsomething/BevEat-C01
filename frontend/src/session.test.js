import { test } from "node:test";
import assert from "node:assert/strict";
import { isExpired } from "./session.js";

// fake JWT with just the payload part we need
const tokenWithExp = (exp) =>
  "x." + Buffer.from(JSON.stringify({ id: 3, role: "child", exp })).toString("base64url") + ".y";
const now = Math.floor(Date.now() / 1000);

test("token still valid", () => {
  assert.equal(isExpired(tokenWithExp(now + 8 * 60 * 60)), false);
});

test("token past 8h is expired", () => {
  assert.equal(isExpired(tokenWithExp(now - 1)), true);
});

test("broken or missing token counts as expired", () => {
  assert.equal(isExpired("not-a-token"), true);
  assert.equal(isExpired(undefined), true);
  assert.equal(isExpired(tokenWithExp(undefined)), true);
});
