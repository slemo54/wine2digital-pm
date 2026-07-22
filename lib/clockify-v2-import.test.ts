import assert from "node:assert/strict";
import test from "node:test";
import { ClockifyImportError, parseClockifyProjectCsv } from "./clockify-v2-import";

test("Clockify import validates the exact header and expected project count before planning writes", () => {
  assert.deepEqual(parseClockifyProjectCsv("Project,Client\nAlpha,Acme\nBeta,Acme\n", 2), [{ name: "Alpha", client: "Acme", normalizedClient: "acme" }, { name: "Beta", client: "Acme", normalizedClient: "acme" }]);
  assert.throws(() => parseClockifyProjectCsv("Client,Project\nAcme,Alpha\n", 1), ClockifyImportError);
  assert.throws(() => parseClockifyProjectCsv("Project,Client\nAlpha,Acme\n", 21), /expected 21/i);
});
