import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decideTaskListDeletion } from "@/lib/task-list-deletion";

test("project list detail route is reachable (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.PUT === "function");
  assert.ok(typeof mod.DELETE === "function");
});

test("empty categories including Generale can be deleted", async () => {
  assert.deepEqual(decideTaskListDeletion({ name: "Marketing", taskCount: 0 }), { ok: true });
  assert.deepEqual(decideTaskListDeletion({ name: "Generale", taskCount: 0 }), { ok: true });
});

test("non-empty categories are rejected without moving or deleting tasks", async () => {
  assert.deepEqual(decideTaskListDeletion({ name: "Marketing", taskCount: 2 }), {
    ok: false,
    status: 409,
    error: "La categoria contiene ancora delle task. Spostale prima di eliminarla.",
    taskCount: 2,
  });

  const routeSource = await readFile(new URL("./route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(routeSource, /taskList\.upsert/);
  assert.doesNotMatch(routeSource, /task\.updateMany/);
  assert.doesNotMatch(routeSource, /Cannot delete default list/);
});

test("project list UI explains non-empty deletion and does not protect Generale", async () => {
  const componentSource = await readFile(
    new URL("../../../../../../components/project-task-lists.tsx", import.meta.url),
    "utf8"
  );

  assert.match(componentSource, /Sposta prima le .* task/);
  assert.doesNotMatch(componentSource, /disabled=\{l\.name === DEFAULT_LIST_NAME\}/);
  assert.doesNotMatch(componentSource, /Le task verranno spostate in/);
});
