import test from "node:test";
import assert from "node:assert/strict";

import { buildAbsenceDecisionEmail, buildAbsoluteUrl, buildChatEmail, buildMentionEmail } from "@/lib/email/notifications";

test("buildAbsoluteUrl: uses NEXTAUTH_URL base for relative paths", () => {
  const prev = process.env.NEXTAUTH_URL;
  try {
    process.env.NEXTAUTH_URL = "https://pm.wine2digital.com";
    assert.equal(buildAbsoluteUrl("/calendar"), "https://pm.wine2digital.com/calendar");
    assert.equal(buildAbsoluteUrl("project/1"), "https://pm.wine2digital.com/project/1");
    assert.equal(buildAbsoluteUrl("https://example.com/x"), "https://example.com/x");
  } finally {
    if (prev === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prev;
  }
});

test("buildMentionEmail: includes key fields", () => {
  const prev = process.env.NEXTAUTH_URL;
  try {
    process.env.NEXTAUTH_URL = "https://pm.wine2digital.com";
    const e = buildMentionEmail({
      authorLabel: "Mario",
      taskTitle: "Task A",
      subtaskTitle: "Sub B",
      link: "/tasks?taskId=1&subtaskId=2",
    });
    assert.ok(e.subject.includes("Menzione"));
    assert.ok(e.text.includes("Mario"));
    assert.ok(e.text.includes("Task A"));
    assert.ok(e.text.includes("Sub B"));
    assert.ok(e.text.includes("https://pm.wine2digital.com/tasks?taskId=1&subtaskId=2"));
  } finally {
    if (prev === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prev;
  }
});

test("buildChatEmail: includes preview and link", () => {
  const prev = process.env.NEXTAUTH_URL;
  try {
    process.env.NEXTAUTH_URL = "https://pm.wine2digital.com";
    const e = buildChatEmail({
      projectName: "Proj",
      authorLabel: "a@b.com",
      messagePreview: "hello",
      link: "/project/xyz",
    });
    assert.ok(e.subject.includes("Nuovo messaggio"));
    assert.ok(e.text.includes("Proj"));
    assert.ok(e.text.includes("hello"));
    assert.ok(e.text.includes("https://pm.wine2digital.com/project/xyz"));
  } finally {
    if (prev === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prev;
  }
});

test("buildAbsenceDecisionEmail: approved/rejected labels", () => {
  const prev = process.env.NEXTAUTH_URL;
  try {
    process.env.NEXTAUTH_URL = "https://pm.wine2digital.com";
    const a = buildAbsenceDecisionEmail({
      status: "approved",
      startDateLabel: "01/01/2026",
      endDateLabel: "02/01/2026",
      link: "/calendar",
    });
    assert.ok(a.subject.includes("Approvata"));
    const r = buildAbsenceDecisionEmail({
      status: "rejected",
      startDateLabel: "01/01/2026",
      endDateLabel: "02/01/2026",
      link: "/calendar",
    });
    assert.ok(r.subject.includes("Rifiutata"));
  } finally {
    if (prev === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prev;
  }
});

