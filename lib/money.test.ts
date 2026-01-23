import test from "node:test";
import assert from "node:assert/strict";

import { parseEurToCents } from "@/lib/money";

test("parseEurToCents parses Italian and dot-decimal formats", () => {
  assert.equal(parseEurToCents(""), null);
  assert.equal(parseEurToCents("0"), 0);
  assert.equal(parseEurToCents("10"), 1000);
  assert.equal(parseEurToCents("10,5"), 1050);
  assert.equal(parseEurToCents("10,50"), 1050);
  assert.equal(parseEurToCents("10.50"), 1050);
  assert.equal(parseEurToCents("1.234,56"), 123456);
  assert.equal(parseEurToCents("€ 1.234,56"), 123456);
  assert.equal(parseEurToCents("1234,56"), 123456);
  assert.equal(parseEurToCents("1234.56"), 123456);
  assert.equal(parseEurToCents("1.234"), 123400);
  assert.equal(parseEurToCents("1,234"), 123400);
  assert.equal(parseEurToCents("1.234.567,89"), 123456789);
  assert.equal(parseEurToCents("1,234,567.89"), 123456789);
});

test("parseEurToCents rejects invalid values", () => {
  assert.equal(parseEurToCents("-1"), null);
  assert.equal(parseEurToCents("abc"), null);
  assert.equal(parseEurToCents("12,345"), 1234500); // treated as thousands separator (US-style)
  assert.equal(parseEurToCents("12.345"), 1234500); // treated as thousands separator
});

