import test from "node:test";
import assert from "node:assert/strict";
import { refreshGoogleAccessToken } from "@/lib/auth-options";

test("refreshGoogleAccessToken falls back to existing token on failure", async () => {
  const originalFetch = global.fetch;
  // Mock failed response
  global.fetch = async () =>
    ({
      ok: false,
      json: async () => ({ error: "invalid_grant" }),
    } as any);

  const token: any = {
    accessToken: "old",
    refreshToken: "refresh-token",
    accessTokenExpires: Date.now() - 1000,
  };

  const refreshed = await refreshGoogleAccessToken(token);
  assert.equal(refreshed.accessToken, "old");
  assert.equal(refreshed.error, "RefreshAccessTokenError");

  global.fetch = originalFetch;
});


