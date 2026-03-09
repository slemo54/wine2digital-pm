import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Mocking prisma if needed, but here we can try to see if it imports and fails as expected
// Note: In this environment, we might not have a real DB but we can check logic.

test("signup route POST requires inviteToken", async () => {
  const req = new NextRequest("http://localhost:3000/api/signup", {
    method: "POST",
    body: JSON.stringify({
      email: "test@example.com",
      password: "password123",
      firstName: "Test",
      lastName: "User"
    })
  });

  const response = await POST(req);
  const data = await response.json();

  assert.strictEqual(response.status, 400);
  assert.strictEqual(data.error, "Invite token is required");
});
