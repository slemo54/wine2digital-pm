import test from "node:test";
import assert from "node:assert/strict";

import { emitNotificationsChanged, markAllRead, markNotificationRead, markTaskNotificationsRead } from "@/lib/notifications-client";

test("emitNotificationsChanged: dispatches notifications:changed when window exists", () => {
  const g = globalThis as any;
  const prevWindow = g.window;
  try {
    let lastType = "";
    g.window = {
      dispatchEvent: (ev: any) => {
        lastType = String(ev?.type || "");
        return true;
      },
    };
    emitNotificationsChanged();
    assert.equal(lastType, "notifications:changed");
  } finally {
    if (prevWindow === undefined) delete g.window;
    else g.window = prevWindow;
  }
});

test("markNotificationRead: PUT /api/notifications with notificationId and emits event", async () => {
  const g = globalThis as any;
  const prevFetch = g.fetch;
  const prevWindow = g.window;
  try {
    let dispatched = false;
    g.window = {
      dispatchEvent: (ev: any) => {
        if (String(ev?.type || "") === "notifications:changed") dispatched = true;
        return true;
      },
    };

    let called: any = null;
    g.fetch = async (input: any, init: any) => {
      called = { input, init };
      return { ok: true, json: async () => ({ unreadCount: 3 }) } as any;
    };

    const r = await markNotificationRead("  n1  ");
    assert.equal(r.ok, true);
    assert.equal(r.unreadCount, 3);
    assert.equal(dispatched, true);
    assert.equal(called.input, "/api/notifications");
    assert.equal(called.init.method, "PUT");
    assert.equal(called.init.headers["Content-Type"], "application/json");
    assert.equal(called.init.body, JSON.stringify({ notificationId: "n1" }));
  } finally {
    g.fetch = prevFetch;
    if (prevWindow === undefined) delete g.window;
    else g.window = prevWindow;
  }
});

test("markAllRead: PUT /api/notifications with markAllRead and emits event", async () => {
  const g = globalThis as any;
  const prevFetch = g.fetch;
  const prevWindow = g.window;
  try {
    let dispatched = false;
    g.window = {
      dispatchEvent: (ev: any) => {
        if (String(ev?.type || "") === "notifications:changed") dispatched = true;
        return true;
      },
    };

    let called: any = null;
    g.fetch = async (input: any, init: any) => {
      called = { input, init };
      return { ok: true, json: async () => ({ unreadCount: 0 }) } as any;
    };

    const r = await markAllRead();
    assert.equal(r.ok, true);
    assert.equal(r.unreadCount, 0);
    assert.equal(dispatched, true);
    assert.equal(called.input, "/api/notifications");
    assert.equal(called.init.method, "PUT");
    assert.equal(called.init.body, JSON.stringify({ markAllRead: true }));
  } finally {
    g.fetch = prevFetch;
    if (prevWindow === undefined) delete g.window;
    else g.window = prevWindow;
  }
});

test("markTaskNotificationsRead: PUT /api/notifications with taskId and emits event", async () => {
  const g = globalThis as any;
  const prevFetch = g.fetch;
  const prevWindow = g.window;
  try {
    let dispatched = false;
    g.window = {
      dispatchEvent: (ev: any) => {
        if (String(ev?.type || "") === "notifications:changed") dispatched = true;
        return true;
      },
    };

    let called: any = null;
    g.fetch = async (input: any, init: any) => {
      called = { input, init };
      return { ok: true, json: async () => ({ unreadCount: 1 }) } as any;
    };

    const r = await markTaskNotificationsRead("  t1  ");
    assert.equal(r.ok, true);
    assert.equal(r.unreadCount, 1);
    assert.equal(dispatched, true);
    assert.equal(called.input, "/api/notifications");
    assert.equal(called.init.method, "PUT");
    assert.equal(called.init.body, JSON.stringify({ taskId: "t1" }));
  } finally {
    g.fetch = prevFetch;
    if (prevWindow === undefined) delete g.window;
    else g.window = prevWindow;
  }
});

test("markNotificationRead: returns ok=false for empty id without calling fetch", async () => {
  const g = globalThis as any;
  const prevFetch = g.fetch;
  try {
    let called = false;
    g.fetch = async () => {
      called = true;
      return { ok: true, json: async () => ({}) } as any;
    };
    const r = await markNotificationRead("   ");
    assert.equal(r.ok, false);
    assert.equal(called, false);
  } finally {
    g.fetch = prevFetch;
  }
});

