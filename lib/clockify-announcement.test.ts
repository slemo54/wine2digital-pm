import test from "node:test";
import assert from "node:assert/strict";
import {
  CLOCKIFY_ANNOUNCEMENT_KEY,
  shouldShowClockifyAnnouncement,
} from "./clockify-announcement";

test("Clockify announcement has a stable persistence key", () => {
  assert.equal(CLOCKIFY_ANNOUNCEMENT_KEY, "clockify-module-v1");
});

test("Clockify announcement is shown only when enabled and unread", () => {
  assert.equal(shouldShowClockifyAnnouncement({ enabled: true, readAt: null }), true);
  assert.equal(shouldShowClockifyAnnouncement({ enabled: true, readAt: new Date() }), false);
  assert.equal(shouldShowClockifyAnnouncement({ enabled: false, readAt: null }), false);
});
