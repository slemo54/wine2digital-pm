import test from "node:test";
import assert from "node:assert/strict";
import { deriveStatusFromTitle, mapGoogleEvent } from "@/lib/google-calendar";

test("deriveStatusFromTitle maps keywords correctly", () => {
  assert.equal(deriveStatusFromTitle("WFH (Work From Home)"), "wfh");
  assert.equal(deriveStatusFromTitle("Leave Request Pending"), "leave_pending");
  assert.equal(deriveStatusFromTitle("Leave (Approved)"), "leave_approved");
  assert.equal(deriveStatusFromTitle("Present - General Shift"), "present");
  assert.equal(deriveStatusFromTitle("Random Meeting"), "other");
});

test("mapGoogleEvent returns normalized event", () => {
  const raw = {
    id: "1",
    summary: "Present",
    start: { dateTime: "2025-01-10T09:00:00Z" },
    end: { dateTime: "2025-01-10T17:00:00Z" },
    location: "HQ",
  };

  const result = mapGoogleEvent(raw);
  assert.equal(result.id, "1");
  assert.equal(result.title, "Present");
  assert.equal(result.start, "2025-01-10T09:00:00Z");
  assert.equal(result.end, "2025-01-10T17:00:00Z");
  assert.equal(result.allDay, false);
  assert.equal(result.status, "present");
  assert.equal(result.location, "HQ");
});


