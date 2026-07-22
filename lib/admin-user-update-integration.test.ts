import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

test("admin users page sends isActive without renaming it to active", async () => {
  const page = await source("app/admin/users/page.tsx");

  assert.doesNotMatch(page, /apiPatch\.active\s*=/);
  assert.match(page, /updateMutation\.mutate\(\{ id, data: patch \}\)/);
});

test("admin user API validates updates with the shared contract", async () => {
  const route = await source("app/api/admin/users/[id]/route.ts");

  assert.match(route, /parseAdminUserUpdate\(await req\.json\(\)\)/);
  assert.match(route, /wouldDisableLastActiveAdmin/);
  assert.match(route, /changes: buildAdminUserAuditChanges\(target, updated\)/);
});

test("NextAuth session callback hides disabled users", async () => {
  const authOptions = await source("lib/auth-options.ts");

  assert.match(authOptions, /exposeActiveSessionUser/);
  assert.match(authOptions, /gToken\.isActive/);
});
