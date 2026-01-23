import test from "node:test";
import assert from "node:assert/strict";
import { validateSubtaskDependencyCreation } from "@/lib/subtask-dependencies";

test("subtasks/[subtaskId]/dependencies route exports handlers (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.POST === "function");
});

test("validateSubtaskDependencyCreation: self-dependency rejected", () => {
  const res = validateSubtaskDependencyCreation({
    subtaskId: "A",
    dependsOnId: "A",
    subtaskTaskId: "T1",
    dependsOnTaskId: "T1",
    existingEdges: [],
  });
  assert.deepEqual(res, { ok: false, error: "self_dependency" });
});

test("validateSubtaskDependencyCreation: cross-task rejected", () => {
  const res = validateSubtaskDependencyCreation({
    subtaskId: "A",
    dependsOnId: "B",
    subtaskTaskId: "T1",
    dependsOnTaskId: "T2",
    existingEdges: [],
  });
  assert.deepEqual(res, { ok: false, error: "cross_task" });
});

test("validateSubtaskDependencyCreation: cycle rejected", () => {
  // Existing: B depends on A. Adding A depends on B would create a cycle.
  const res = validateSubtaskDependencyCreation({
    subtaskId: "A",
    dependsOnId: "B",
    subtaskTaskId: "T1",
    dependsOnTaskId: "T1",
    existingEdges: [{ subtaskId: "B", dependsOnId: "A" }],
  });
  assert.deepEqual(res, { ok: false, error: "cycle" });
});

test("validateSubtaskDependencyCreation: valid dependency ok", () => {
  const res = validateSubtaskDependencyCreation({
    subtaskId: "A",
    dependsOnId: "B",
    subtaskTaskId: "T1",
    dependsOnTaskId: "T1",
    existingEdges: [{ subtaskId: "C", dependsOnId: "B" }],
  });
  assert.deepEqual(res, { ok: true });
});
