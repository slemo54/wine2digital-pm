import test from "node:test";
import assert from "node:assert/strict";
import { exposeActiveSessionUser } from "./active-session";

test("exposeActiveSessionUser hides a disabled JWT user", () => {
  assert.equal(
    exposeActiveSessionUser(
      { id: "user-1", email: "former@example.com", role: "member" },
      false,
    ),
    undefined,
  );
});

test("exposeActiveSessionUser preserves an active JWT user", () => {
  const user = { id: "user-1", email: "active@example.com", role: "member" };
  assert.equal(exposeActiveSessionUser(user, true), user);
});
