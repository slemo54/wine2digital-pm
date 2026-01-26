import test from "node:test";
import assert from "node:assert/strict";

test("project tags route exports handlers (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.GET === "function");
  assert.ok(typeof mod.POST === "function");
});

test("tagSchema validation", async () => {
  const { tagSchema } = await import("@/lib/project-tag-schema");

  // Valid cases
  assert.ok(tagSchema.safeParse({ name: "TAG", color: "#ef4444" }).success);
  assert.ok(tagSchema.safeParse({ name: "TAG", color: "#ABCDEF" }).success);
  assert.ok(tagSchema.safeParse({ name: "TAG" }).success); // optional

  // Invalid cases
  assert.strictEqual(tagSchema.safeParse({ name: "TAG", color: "ef4444" }).success, false); // missing #
  assert.strictEqual(tagSchema.safeParse({ name: "TAG", color: "#12345G" }).success, false); // invalid hex char
  assert.strictEqual(tagSchema.safeParse({ name: "TAG", color: "#123" }).success, false); // too short
  assert.strictEqual(tagSchema.safeParse({ name: "TAG", color: "#1234567" }).success, false); // too long
});

test("tagUpdateSchema validation", async () => {
  const { tagUpdateSchema } = await import("@/lib/project-tag-schema");

  // Valid cases
  assert.ok(tagUpdateSchema.safeParse({ name: "TAG" }).success);
  assert.ok(tagUpdateSchema.safeParse({ color: "#ef4444" }).success);
  assert.ok(tagUpdateSchema.safeParse({ name: "TAG", color: "#ABCDEF" }).success);

  // Invalid cases
  assert.strictEqual(tagUpdateSchema.safeParse({}).success, false); // require at least one field
  assert.strictEqual(tagUpdateSchema.safeParse({ color: "ef4444" }).success, false); // missing #
});

