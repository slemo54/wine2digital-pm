import test from "node:test";
import assert from "node:assert/strict";
import { canAccessCalendar } from "./calendar-access";

test("canAccessCalendar - Admin always has access", () => {
  assert.strictEqual(canAccessCalendar({ role: "admin", calendarEnabled: true }), true);
  assert.strictEqual(canAccessCalendar({ role: "admin", calendarEnabled: false }), true);
  assert.strictEqual(canAccessCalendar({ role: "ADMIN", calendarEnabled: false }), true);
});

test("canAccessCalendar - Manager access", () => {
  assert.strictEqual(canAccessCalendar({ role: "manager", calendarEnabled: true }), true);
  assert.strictEqual(canAccessCalendar({ role: "manager", calendarEnabled: false }), false);
  assert.strictEqual(canAccessCalendar({ role: "manager" }), true); // default true
});

test("canAccessCalendar - Member access", () => {
  assert.strictEqual(canAccessCalendar({ role: "member", calendarEnabled: true }), true);
  assert.strictEqual(canAccessCalendar({ role: "member", calendarEnabled: false }), false);
  assert.strictEqual(canAccessCalendar({ role: "member" }), true); // default true
});

test("canAccessCalendar - Default role is member", () => {
  assert.strictEqual(canAccessCalendar({ calendarEnabled: true }), true);
  assert.strictEqual(canAccessCalendar({ calendarEnabled: false }), false);
});
