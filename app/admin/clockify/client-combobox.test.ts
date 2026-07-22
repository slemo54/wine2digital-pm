import assert from "node:assert/strict";
import test from "node:test";
import { nextClientComboboxIndex } from "./client-combobox";

test("client combobox keyboard navigation wraps and Escape closes without selecting", () => {
  assert.equal(nextClientComboboxIndex("ArrowDown", -1, 3), 0);
  assert.equal(nextClientComboboxIndex("ArrowDown", 2, 3), 0);
  assert.equal(nextClientComboboxIndex("ArrowUp", 0, 3), 2);
  assert.equal(nextClientComboboxIndex("Home", 2, 3), 0);
  assert.equal(nextClientComboboxIndex("End", 0, 3), 2);
  assert.equal(nextClientComboboxIndex("Escape", 1, 3), -1);
});
