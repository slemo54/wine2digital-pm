import assert from "node:assert/strict";
import test from "node:test";
import { GET as clientsGet } from "./clients/route";
import { createClientsRouteHandlers } from "@/lib/clockify-v2-clients-route";
import { getClockifyV2CatalogActor } from "@/lib/clockify-v2-api";
import { POST as archivePost } from "./projects/[projectId]/archive/route";
import { POST as taskDeactivatePost } from "./projects/[projectId]/tasks/[taskId]/deactivate/route";

function withV2Flag(value: string | undefined, run: () => Promise<void>): Promise<void> {
  const previous = process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
  if (value === undefined) delete process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
  else process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = value;
  return run().finally(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED; else process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = previous; });
}

test("V2 catalog route handlers return stable flag-disabled responses for clients, archive, and task status", async () => {
  await withV2Flag(undefined, async () => {
    const clients = await clientsGet(new Request("http://test/api/clockify/v2/clients") as any);
    const archive = await archivePost(new Request("http://test") as any, { params: { projectId: "p1" } });
    const task = await taskDeactivatePost(new Request("http://test") as any, { params: { projectId: "p1", taskId: "t1" } });
    for (const response of [clients, archive, task]) {
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Not found" });
    }
  });
});

test("V2 clients route handler returns stable 401 JSON without a session", async () => {
  await withV2Flag("true", async () => {
    const response = await clientsGet(new Request("http://test/api/clockify/v2/clients") as any);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  });
});

test("V2 clients route handler denies an authenticated, DB-active member with stable 403 JSON", async () => {
  const handler = createClientsRouteHandlers({
    getActor: () => getClockifyV2CatalogActor({
      isEnabled: () => true,
      getSession: async () => ({ id: "member-1", email: "member@example.test", globalRole: "manager", department: "Sales" }),
      findUser: async () => ({ id: "member-1", role: "member", department: "Marketing", isActive: true }),
    }),
    listClients: async () => [],
    createClient: async () => { throw new Error("not called"); },
  });
  const response = await handler.GET(new Request("http://test/api/clockify/v2/clients") as any);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden" });
});
