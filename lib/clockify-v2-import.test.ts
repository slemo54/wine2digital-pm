import assert from "node:assert/strict";
import test from "node:test";
import { ClockifyImportError, parseClockifyProjectCsv } from "./clockify-v2-import";

test("Clockify import validates the exact header and expected project count before planning writes", () => {
  assert.deepEqual(parseClockifyProjectCsv("Project,Client\nAlpha,Acme\nBeta,Acme\n", 2), [{ name: "Alpha", client: "Acme", normalizedClient: "acme" }, { name: "Beta", client: "Acme", normalizedClient: "acme" }]);
  assert.throws(() => parseClockifyProjectCsv("Client,Project\nAcme,Alpha\n", 1), ClockifyImportError);
  assert.throws(() => parseClockifyProjectCsv("Project,Client\nAlpha,Acme\n", 21), /expected 21/i);
});

test("Clockify import parses a BOM header and rejects blank project rows", () => {
  assert.equal(parseClockifyProjectCsv("\uFEFFProject,Client\nAlpha,Acme\n", 1)[0].name, "Alpha");
  assert.throws(() => parseClockifyProjectCsv("Project,Client\n,Acme\n", 0), ClockifyImportError);
});
