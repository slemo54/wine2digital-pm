import assert from "node:assert/strict";
import test from "node:test";
import { PATCH, DELETE } from "./[entryId]/route";
import { POST as duplicate } from "./[entryId]/duplicate/route";
import { POST as split } from "./[entryId]/split/route";

test("production V2 entry mutation route modules return the feature-disabled status before parsing", async () => {
  const previous = process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
  delete process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
  try {
    const request = new Request("http://test/api/clockify/v2/entries/e1", { method: "PATCH", body: "{}" }) as any;
    const responses = await Promise.all([
      PATCH(request, { params: { entryId: "e1" } }),
      DELETE(new Request("http://test") as any, { params: { entryId: "e1" } }),
      duplicate(new Request("http://test", { method: "POST", body: "{}" }) as any, { params: { entryId: "e1" } }),
      split(new Request("http://test", { method: "POST", body: "{}" }) as any, { params: { entryId: "e1" } }),
    ]);
    for (const response of responses) assert.equal(response.status, 404);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
    else process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = previous;
  }
});

test("production V2 entry mutation route modules return 401 without an authenticated active user", async () => {
  const previous = process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
  process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = "true";
  try {
    const responses = await Promise.all([
      PATCH(new Request("http://test", { method: "PATCH", body: "{}" }) as any, { params: { entryId: "e1" } }),
      DELETE(new Request("http://test") as any, { params: { entryId: "e1" } }),
      duplicate(new Request("http://test", { method: "POST", body: "{}" }) as any, { params: { entryId: "e1" } }),
      split(new Request("http://test", { method: "POST", body: "{}" }) as any, { params: { entryId: "e1" } }),
    ]);
    for (const response of responses) assert.equal(response.status, 401);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
    else process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = previous;
  }
});
