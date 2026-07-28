import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function runtimeSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return runtimeSources(path);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) return [];
    return [path];
  });
}

test("application runtime does not expose the public Elfsight chatbot", () => {
  const files = [...runtimeSources(join(process.cwd(), "app")), ...runtimeSources(join(process.cwd(), "components"))];
  const exposedBy = files.filter((path) => /elfsightcdn\.com|elfsight-app-/i.test(readFileSync(path, "utf8")));

  assert.deepEqual(exposedBy, []);
});
