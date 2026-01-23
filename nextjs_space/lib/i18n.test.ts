import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLocale, t } from "./i18n";

test("normalizeLocale", () => {
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("it"), "it");
  assert.equal(normalizeLocale("it-IT"), "en");
  assert.equal(normalizeLocale(null), "en");
});

test("t() returns expected English strings", () => {
  assert.equal(t("en", "theme.switchToDark"), "Switch to dark theme");
  assert.equal(t("en", "theme.switchToLight"), "Switch to light theme");
});


