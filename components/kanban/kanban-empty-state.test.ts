import test from "node:test";
import assert from "node:assert/strict";
import { getKanbanEmptyState } from "./kanban-empty-state";

test("getKanbanEmptyState returns models for known statuses", () => {
  assert.equal(getKanbanEmptyState("todo")?.icon, "todo");
  assert.equal(getKanbanEmptyState("in_progress")?.icon, "in_progress");
  assert.equal(getKanbanEmptyState("done")?.icon, "done");
});

test("getKanbanEmptyState returns null for unknown status", () => {
  assert.equal(getKanbanEmptyState("review"), null);
});


