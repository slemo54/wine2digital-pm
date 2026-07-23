import test from "node:test";
import assert from "node:assert/strict";
import { isClockifyEnabled } from "./feature-flags";

test("Clockify is enabled by default", () => {
  const previous = process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED;
  delete process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED;
  try {
    assert.equal(isClockifyEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED;
    else process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED = previous;
  }
});

test("Clockify can be explicitly disabled", () => {
  const previous = process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED;
  process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED = "false";
  try {
    assert.equal(isClockifyEnabled(), false);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED;
    else process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED = previous;
  }
});
