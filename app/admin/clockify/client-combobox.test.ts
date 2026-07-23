import assert from "node:assert/strict";
import test from "node:test";
import { nextClientComboboxIndex, shouldCloseClientCombobox } from "./client-combobox";

test("client combobox keyboard navigation wraps and Escape closes without selecting", () => {
  assert.equal(nextClientComboboxIndex("ArrowDown", -1, 3), 0);
  assert.equal(nextClientComboboxIndex("ArrowDown", 2, 3), 0);
  assert.equal(nextClientComboboxIndex("ArrowUp", 0, 3), 2);
  assert.equal(nextClientComboboxIndex("Home", 2, 3), 0);
  assert.equal(nextClientComboboxIndex("End", 0, 3), 2);
  assert.equal(nextClientComboboxIndex("Escape", 1, 3), -1);
});

test("client combobox closes only when focus leaves its container", () => {
  const internal = {} as Node;
  const external = {} as Node;
  const container = { contains: (target: Node | null) => target === internal } as unknown as Pick<Node, "contains">;
  assert.equal(shouldCloseClientCombobox(container, internal), false);
  assert.equal(shouldCloseClientCombobox(container, external), true);
  assert.equal(shouldCloseClientCombobox(container, null), true);
});
