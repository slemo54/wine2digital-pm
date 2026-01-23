import test from "node:test";
import assert from "node:assert/strict";

import { getResendFrom, isEmailNotificationsEnabled, sendEmail } from "@/lib/email/resend";

test("isEmailNotificationsEnabled: true only when env is 'true'", () => {
  const prev = process.env.EMAIL_NOTIFICATIONS_ENABLED;
  try {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
    assert.equal(isEmailNotificationsEnabled(), true);
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
    assert.equal(isEmailNotificationsEnabled(), false);
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "";
    assert.equal(isEmailNotificationsEnabled(), false);
    delete process.env.EMAIL_NOTIFICATIONS_ENABLED;
    assert.equal(isEmailNotificationsEnabled(), false);
  } finally {
    if (prev === undefined) delete process.env.EMAIL_NOTIFICATIONS_ENABLED;
    else process.env.EMAIL_NOTIFICATIONS_ENABLED = prev;
  }
});

test("getResendFrom: falls back to pm@justdothework.it", () => {
  const prev = process.env.RESEND_FROM;
  try {
    delete process.env.RESEND_FROM;
    assert.equal(getResendFrom(), "pm@justdothework.it");
    process.env.RESEND_FROM = "  foo@bar.com ";
    assert.equal(getResendFrom(), "foo@bar.com");
  } finally {
    if (prev === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = prev;
  }
});

test("sendEmail: returns skipped when EMAIL_NOTIFICATIONS_ENABLED is false", async () => {
  const prevEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED;
  const prevKey = process.env.RESEND_API_KEY;
  try {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
    delete process.env.RESEND_API_KEY;
    const r = await sendEmail({ to: "x@example.com", subject: "Hi", text: "Hello" });
    assert.equal(r.ok, true);
    assert.equal((r as any).skipped, true);
  } finally {
    if (prevEnabled === undefined) delete process.env.EMAIL_NOTIFICATIONS_ENABLED;
    else process.env.EMAIL_NOTIFICATIONS_ENABLED = prevEnabled;
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
  }
});

