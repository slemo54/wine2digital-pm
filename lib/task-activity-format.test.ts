import test from "node:test";
import assert from "node:assert/strict";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

test("formatTaskActivityEvent formats status change in Italian", () => {
  const e = {
    id: "1",
    type: "task.status_changed",
    createdAt: new Date().toISOString(),
    actor: null,
    metadata: { from: "todo", to: "in_progress" },
  };
  const result = formatTaskActivityEvent(e as any);
  assert.equal(result.message, "ha cambiato lo status da Da fare a In corso");
});

test("formatTaskActivityEvent formats attachment upload with filename", () => {
  const e = {
    id: "1",
    type: "task.attachment_uploaded",
    createdAt: new Date().toISOString(),
    actor: null,
    metadata: { fileName: "spec.pdf" },
  };
  const result = formatTaskActivityEvent(e as any);
  assert.equal(result.message, "ha caricato un allegato: spec.pdf");
});


