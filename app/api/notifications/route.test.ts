import test from "node:test";
import assert from "node:assert/strict";

test("notifications route exports handlers (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.GET === "function");
  assert.ok(typeof mod.PUT === "function");
});

test("notifications where: buildMarkNotificationReadWhere scopes to userId", async () => {
  const mod = await import("./where");
  assert.deepEqual(mod.buildMarkNotificationReadWhere("u1", "n1"), { id: "n1", userId: "u1" });
});

test("notifications where: buildMarkTaskNotificationsReadWhere uses contains taskId token", async () => {
  const mod = await import("./where");
  assert.deepEqual(mod.buildMarkTaskNotificationsReadWhere("u1", "task_1"), {
    userId: "u1",
    isRead: false,
    link: { contains: "taskId=task_1" },
  });
  assert.deepEqual(mod.buildMarkTaskNotificationsReadWhere("u1", "a b"), {
    userId: "u1",
    isRead: false,
    link: { contains: "taskId=a%20b" },
  });
});
