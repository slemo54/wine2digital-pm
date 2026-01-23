import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMentionNotifications,
  filterMentionedUserIdsToAllowed,
  isEffectivelyEmptyRichContent,
  normalizeMentionedUserIds,
  sanitizeRichHtml,
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

test("sanitizeRichHtml removes scripts and unsafe attributes and schemes", () => {
  const html = `
    <p onclick="alert(1)">Ciao <strong>mondo</strong> <script>alert(2)</script></p>
    <img src="javascript:alert(1)" onerror="alert(3)" />
    <a href="javascript:alert(1)">bad</a>
    <a href="https://example.com" onclick="alert(1)">ok</a>
    <span data-type="mention" data-id="u1" data-label="Mario" onclick="x">@Mario</span>
  `;
  const out = sanitizeRichHtml(html);
  assert.ok(!out.includes("<script"));
  assert.ok(!out.includes("onclick="));
  assert.ok(!out.toLowerCase().includes("javascript:"));
  assert.ok(out.includes("strong"));
  assert.ok(out.includes('data-type="mention"'));
});

test("filterMentionedUserIdsToAllowed keeps only allowed ids preserving order", () => {
  assert.deepEqual(filterMentionedUserIdsToAllowed(["u1", "u2", "u3"], ["u2", "u1"]), ["u1", "u2"]);
});


