import assert from "node:assert/strict";
import test from "node:test";
import { canUseClockifyV2Catalog, parseClockifyV2Json } from "./clockify-v2-api";

test("Clockify V2 JSON parser returns stable 400 errors for malformed and non-object bodies", async () => {
  await assert.rejects(
    () => parseClockifyV2Json(new Request("http://test", { method: "POST", body: "{" })),
    { message: "Invalid JSON body" }
  );
  await assert.rejects(
    () => parseClockifyV2Json(new Request("http://test", { method: "POST", body: "[]" })),
    { message: "JSON body must be an object" }
  );
});

test("Clockify V2 catalog authorization produces the member 403 policy", () => {
  assert.equal(canUseClockifyV2Catalog("admin"), true);
  assert.equal(canUseClockifyV2Catalog("manager"), true);
  assert.equal(canUseClockifyV2Catalog("member"), false);
});

test("Clockify V2 actor denies a role excluded by the rollout stage even when the global flag is true", async () => {
  const { getClockifyV2Actor } = await import("./clockify-v2-api");
  const result = await getClockifyV2Actor({
    isEnabled: () => true,
    getSession: async () => ({ id: "manager-1", email: "manager@example.test", globalRole: "manager", department: "Sales" }),
    findUser: async () => ({ id: "manager-1", role: "manager", department: "Sales", isActive: true }),
  });
  assert.equal(result.actor, null);
  assert.equal(result.response?.status, 404);
});
