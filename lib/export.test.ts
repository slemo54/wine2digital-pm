import test from "node:test";
import assert from "node:assert/strict";

import { buildDelimitedText, buildXlsHtml, escapeCsvCell, safeFileStem } from "@/lib/export";

test("escapeCsvCell: escapes quotes and wraps in quotes", () => {
  assert.equal(escapeCsvCell('a"b'), "\"a\"\"b\"");
  assert.equal(escapeCsvCell(null), "\"\"");
});

test("buildDelimitedText: uses semicolon by default and includes BOM", () => {
  const out = buildDelimitedText({
    header: ["a", "b"],
    rows: [
      ["1", "2"],
      ["x;y", "z"],
    ],
  });
  assert.ok(out.startsWith("\uFEFF"));
  assert.ok(out.includes("\"a\";\"b\""));
  assert.ok(out.includes("\"x;y\";\"z\""));
});

test("buildXlsHtml: contains a table with headers and cells", () => {
  const html = buildXlsHtml({ header: ["a", "b"], rows: [["1", "2"]] });
  assert.ok(html.includes("<table"));
  assert.ok(html.includes("<th>a</th>"));
  assert.ok(html.includes("<td>1</td>"));
});

test("safeFileStem: sanitizes filenames", () => {
  assert.equal(safeFileStem("  Progetto: ACME/2026 "), "Progetto_ACME_2026");
});

