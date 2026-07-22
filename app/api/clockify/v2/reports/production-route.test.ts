import assert from "node:assert/strict";
import test from "node:test";
import { GET as reportGet } from "./route";
import { GET as shareGet } from "./shares/route";
import { GET as publicGet } from "../shared/[token]/route";

test("production report routes return flag-disabled, unauthenticated, and invalid-public-token responses", async () => {
  const previous = process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
  try {
    delete process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
    assert.equal((await reportGet(new Request("http://test?from=2026-07-01&to=2026-07-02"))).status, 404);
    assert.equal((await shareGet(new Request("http://test"))).status, 404);
    process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = "true";
    assert.equal((await reportGet(new Request("http://test?from=2026-07-01&to=2026-07-02"))).status, 401);
    assert.equal((await publicGet(new Request("http://test"), { params: { token: "invalid" } })).status, 404);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
    else process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = previous;
  }
});
