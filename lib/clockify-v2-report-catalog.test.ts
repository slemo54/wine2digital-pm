import assert from "node:assert/strict";
import test from "node:test";
import { getClockifyReportCatalog } from "./clockify-v2-report-catalog";

const rows = [
  {
    tags: [" urgent ", "client"],
    user: { id: "u2", name: "Maria", email: "maria@example.com", department: "Grafica" },
    project: { id: "p1", name: "Archivio", client: "Acme", clientId: "c1", color: "#FF0000", isActive: false, archivedAt: new Date() },
    clockifyTask: { id: "t1", name: "Ricerca", projectId: "p1", isActive: false },
  },
  {
    tags: ["client"],
    user: { id: "u2", name: "Maria", email: "maria@example.com", department: "Grafica" },
    project: { id: "p1", name: "Archivio", client: "Acme", clientId: "c1", color: "#FF0000", isActive: false, archivedAt: new Date() },
    clockifyTask: null,
  },
];

test("report catalog applies report scope and exposes readable historical choices without duplicates", async () => {
  const calls: any[] = [];
  const db = { clockifyEntry: { findMany: async (input: any) => {
    calls.push(input);
    if (input.select.user) return rows.map((row) => ({ user: row.user }));
    if (input.select.project) return rows.map((row) => ({ project: row.project }));
    if (input.select.clockifyTask) return rows.map((row) => ({ clockifyTask: row.clockifyTask })).filter((row) => row.clockifyTask);
    return rows.map((row) => ({ tags: row.tags }));
  } } };
  const catalog = await getClockifyReportCatalog(db, { userId: "manager", role: "manager", department: " grafica " });
  assert.equal(calls.length, 4);
  assert.equal(calls.every((call) => call.where.user.department.equals === "Grafica"), true);
  assert.deepEqual(calls.map((call) => call.distinct), [["userId"], ["projectId"], ["taskId"], ["tags"]]);
  assert.equal(calls.some((call) => "take" in call), false);
  assert.deepEqual(catalog.departments, ["Grafica"]);
  assert.deepEqual(catalog.users, [{ id: "u2", name: "Maria", email: "maria@example.com", department: "Grafica" }]);
  assert.deepEqual(catalog.clients, [{ id: "c1", name: "Acme" }]);
  assert.equal(catalog.projects[0].archived, true);
  assert.equal(catalog.tasks[0].name, "Ricerca");
  assert.deepEqual(catalog.tags, ["client", "urgent"]);
});

test("member report catalog is always restricted to the member entries", async () => {
  const where: any[] = [];
  const db = { clockifyEntry: { findMany: async (input: any) => { where.push(input.where); return []; } } };
  await getClockifyReportCatalog(db, { userId: "u1", role: "member", department: "Grafica" });
  assert.equal(where.length, 4);
  assert.equal(where.every((value) => value.userId === "u1"), true);
});
