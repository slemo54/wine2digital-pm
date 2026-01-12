import test from "node:test";
import assert from "node:assert/strict";

import { buildTaskAssignedNotifications, getAddedAssigneeIds, normalizeUserIdList } from "@/lib/task-assignment-notifications";

test("normalizeUserIdList: null when not an array, empty when undefined", () => {
  assert.deepEqual(normalizeUserIdList(undefined), []);
  assert.equal(normalizeUserIdList("x" as any), null);
  assert.deepEqual(normalizeUserIdList([" a ", "", "a", 0] as any), ["a", "0"]);
});

test("getAddedAssigneeIds: returns only new ids and excludes actor", () => {
  const added = getAddedAssigneeIds({
    prevAssigneeIds: ["u1", "u2"],
    nextAssigneeIds: ["u2", "u3", "u1", "u4"],
    actorUserId: "u3",
  });
  assert.deepEqual(added, ["u4"]);
});

test("buildTaskAssignedNotifications: creates task_assigned notifications with encoded link", () => {
  const items = buildTaskAssignedNotifications({
    assigneeIds: ["u2"],
    actorLabel: "Mario",
    taskId: "a b",
    taskTitle: "Titolo",
    projectName: "ACME",
  });
  assert.deepEqual(items, [
    {
      userId: "u2",
      type: "task_assigned",
      title: "Sei stato assegnato a una task",
      message: "Mario ti ha assegnato: Titolo (ACME)",
      link: "/tasks?taskId=a%20b",
    },
  ]);
});

