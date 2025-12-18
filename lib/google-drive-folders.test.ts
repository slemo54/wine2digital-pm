import test from "node:test";
import assert from "node:assert/strict";
import { buildDriveUploadFolderNames, getDriveYearMonth, sanitizeDriveFolderName } from "./google-drive";

test("sanitizeDriveFolderName: replaces unsafe characters and trims", () => {
  assert.equal(sanitizeDriveFolderName("  Foo/Bar  "), "Foo-Bar");
  assert.equal(sanitizeDriveFolderName("A:B*C?D\"E<F>G|H"), "A-B-C-D-E-F-G-H");
});

test("getDriveYearMonth: returns YYYY-MM", () => {
  const d = new Date("2025-12-18T10:00:00Z");
  assert.equal(getDriveYearMonth(d, "UTC"), "2025-12");
});

test("buildDriveUploadFolderNames: includes month folder and project folder with id suffix", () => {
  const d = new Date("2025-01-02T00:00:00Z");
  const out = buildDriveUploadFolderNames({
    date: d,
    timeZone: "UTC",
    projectName: "Wine2Digital PM",
    projectId: "abcdef123456",
  });

  assert.equal(out.monthFolderName, "2025-01");
  assert.equal(out.projectFolderName, "Wine2Digital PM - abcdef");
});


