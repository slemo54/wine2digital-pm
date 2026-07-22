import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Clockify one-time announcement is persisted and rendered", () => {
  const route = read("app/api/announcements/clockify/route.ts");
  const component = read("components/clockify-announcement.tsx");
  const schema = read("prisma/schema.prisma");

  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /userAnnouncementRead\.upsert/);
  assert.match(component, /api\/announcements\/clockify/);
  assert.match(component, /Clockify/);
  assert.match(schema, /model UserAnnouncementRead/);
  assert.match(schema, /@@unique\(\[userId, announcementKey\]\)/);
});
