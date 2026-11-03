import { test } from "node:test";
import assert from "node:assert/strict";
import { isSgMobile, isPassword, isUsername, isPin, signupErrors, childErrors } from "./validate.js";

test("Singapore mobile numbers", () => {
  assert.ok(isSgMobile("8123 4567"));
  assert.ok(isSgMobile("91234567"));
  assert.ok(!isSgMobile("61234567")); // landline
  assert.ok(!isSgMobile("8123456"));
});

test("password needs 8+ characters and a number", () => {
  assert.ok(isPassword("hawker123"));
  assert.ok(!isPassword("hawkers!"));
  assert.ok(!isPassword("abc1"));
});

test("kid login name and PIN", () => {
  assert.ok(isUsername("ethan_eats"));
  assert.ok(!isUsername("et"));
  assert.ok(!isUsername("ethan eats"));
  assert.ok(isPin("0420"));
  assert.ok(!isPin("123"));
  assert.ok(!isPin("12a4"));
});

test("sign-up form reports every wrong field", () => {
  const e = signupErrors({ name: " ", mobile: "123", email: "x", password: "short", agreed: false });
  assert.deepEqual(Object.keys(e).sort(), ["agreed", "email", "mobile", "name", "password"]);
  const ok = signupErrors({ name: "Mei Ling", mobile: "81234567", email: "a@b.sg", password: "hawker123", agreed: true });
  assert.deepEqual(ok, {});
});

test("add-child form", () => {
  assert.deepEqual(childErrors({ displayName: "Ethan", username: "ethan", pin: "1234" }), {});
  assert.ok(childErrors({ displayName: "Ethan", username: "ethan", pin: "12" }).pin);
});
