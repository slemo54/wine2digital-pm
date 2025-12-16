import test from "node:test";
import assert from "node:assert/strict";
import { slugifyWikiTitle } from "@/lib/wiki-slug";

test("slugifyWikiTitle creates stable slug", () => {
  assert.equal(slugifyWikiTitle("Design Homepage Wireframe"), "design-homepage-wireframe");
  assert.equal(slugifyWikiTitle("  Ciao, mondo!  "), "ciao-mondo");
});

test("slugifyWikiTitle falls back for empty title", () => {
  assert.equal(slugifyWikiTitle("   "), "pagina");
});


