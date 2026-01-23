import test from "node:test";
import assert from "node:assert/strict";
import { getClockifyVisibility } from "./clockify-scope";

test("clockify scope: admin sees all", () => {
  assert.deepEqual(
    getClockifyVisibility({ globalRole: "admin", userId: "u1", department: null }),
    { kind: "all" }
  );
});

test("clockify scope: member sees self", () => {
  assert.deepEqual(
    getClockifyVisibility({ globalRole: "member", userId: "u1", department: "X" }),
    { kind: "self", userId: "u1" }
  );
});

test("clockify scope: manager with department sees department", () => {
  assert.deepEqual(
    getClockifyVisibility({ globalRole: "manager", userId: "u1", department: "Grafica" }),
    { kind: "department", department: "Grafica" }
  );
});

test("clockify scope: manager without department falls back to self", () => {
  assert.deepEqual(
    getClockifyVisibility({ globalRole: "manager", userId: "u1", department: null }),
    { kind: "self", userId: "u1" }
  );
});

