import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMentionNotifications,
  isEffectivelyEmptyRichContent,
  normalizeMentionedUserIds,
} from "./rich-text";

test("isEffectivelyEmptyRichContent detects empty rich content", () => {
  assert.equal(isEffectivelyEmptyRichContent(""), true);
  assert.equal(isEffectivelyEmptyRichContent("<p></p>"), true);
  assert.equal(isEffectivelyEmptyRichContent("<p>&nbsp;</p>"), true);
  assert.equal(isEffectivelyEmptyRichContent("<p>ciao</p>"), false);
  assert.equal(isEffectivelyEmptyRichContent('<img src="x" />'), false);
});

test("normalizeMentionedUserIds returns unique ids excluding self", () => {
  assert.deepEqual(normalizeMentionedUserIds(null, "me"), []);
  assert.deepEqual(normalizeMentionedUserIds(["a", "a", " me ", "", 0], "me"), ["a"]);
});

test("buildMentionNotifications builds link to open task+subtask drawer", () => {
  const out = buildMentionNotifications({
    mentionedUserIds: ["u1", "u2"],
    authorLabel: "Mario",
    taskId: "t1",
    subtaskId: "s1",
    taskTitle: "Task title",
    subtaskTitle: "Subtask title",
  });
  assert.equal(out.length, 2);
  assert.equal(out[0]?.type, "subtask_mentioned");
  assert.equal(out[0]?.userId, "u1");
  assert.equal(out[0]?.link, "/tasks?taskId=t1&subtaskId=s1");
});


