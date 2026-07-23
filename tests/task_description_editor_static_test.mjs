import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const modalPath = new URL("../components/task-detail-modal.tsx", import.meta.url);
const routePath = new URL("../app/api/tasks/[id]/route.ts", import.meta.url);

test("task detail provides a multiline description editor with save and cancel", async () => {
  const source = await readFile(modalPath, "utf8");

  assert.match(source, /isEditingTaskDescription/);
  assert.match(source, /taskDraftDescription/);
  assert.match(source, /<Textarea/);
  assert.match(source, /aria-label="Modifica descrizione"/);
  assert.match(source, /Descrizione aggiornata/);
  assert.match(source, /Annulla/);
});

test("task description save supports clearing through the normalized API contract", async () => {
  const modalSource = await readFile(modalPath, "utf8");
  const routeSource = await readFile(routePath, "utf8");

  assert.match(modalSource, /description:\s*nextDescription\s*\|\|\s*null/);
  assert.match(routeSource, /normalizeTaskDescriptionUpdate/);
  assert.match(routeSource, /normalizedDescription/);
});
