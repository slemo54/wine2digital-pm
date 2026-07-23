import assert from "node:assert/strict";
import test from "node:test";
import { canUseClockifyV2ForRole, getClockifyV2RolloutStage } from "./clockify-v2-rollout";

test("Clockify V2 rollout defaults to admins and expands only through explicit stages", () => {
  assert.equal(getClockifyV2RolloutStage(undefined), "admin");
  assert.equal(canUseClockifyV2ForRole("admin", true, undefined), true);
  assert.equal(canUseClockifyV2ForRole("manager", true, undefined), false);
  assert.equal(canUseClockifyV2ForRole("member", true, undefined), false);
  assert.equal(canUseClockifyV2ForRole("manager", true, "manager"), true);
  assert.equal(canUseClockifyV2ForRole("member", true, "manager"), false);
  assert.equal(canUseClockifyV2ForRole("member", true, "member"), true);
  assert.equal(canUseClockifyV2ForRole("admin", false, "member"), false);
  assert.equal(getClockifyV2RolloutStage("unexpected"), "admin");
});
