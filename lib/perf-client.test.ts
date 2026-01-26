/**
 * @jest-environment jsdom
 */

import { isPerfEnabled, startPerfTimer, getPerfEvents, clearPerfEvents } from "./perf-client";

describe("perf-client", () => {
  beforeEach(() => {
    clearPerfEvents();
    // Reset URL
    Object.defineProperty(window, "location", {
      value: { search: "", href: "http://localhost/" },
      writable: true,
    });
  });

  describe("isPerfEnabled", () => {
    it("returns false when perf=1 is not in URL", () => {
      expect(isPerfEnabled()).toBe(false);
    });

    it("returns true when perf=1 is in URL", () => {
      Object.defineProperty(window, "location", {
        value: { search: "?perf=1", href: "http://localhost/?perf=1" },
        writable: true,
      });
      expect(isPerfEnabled()).toBe(true);
    });

    it("returns false when perf has different value", () => {
      Object.defineProperty(window, "location", {
        value: { search: "?perf=0", href: "http://localhost/?perf=0" },
        writable: true,
      });
      expect(isPerfEnabled()).toBe(false);
    });
  });

  describe("startPerfTimer", () => {
    it("returns no-op function when perf is disabled", () => {
      const stop = startPerfTimer("test");
      expect(typeof stop).toBe("function");
      stop();
      expect(getPerfEvents()).toHaveLength(0);
    });

    it("records events when perf is enabled", () => {
      Object.defineProperty(window, "location", {
        value: { search: "?perf=1", href: "http://localhost/?perf=1" },
        writable: true,
      });

      const stop = startPerfTimer("test-event", { extra: "data" });
      stop({ result: "ok" });

      const events = getPerfEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe("test-event");
      expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(events[0].meta).toEqual({ extra: "data", result: "ok" });
    });
  });

  describe("clearPerfEvents", () => {
    it("clears all events", () => {
      Object.defineProperty(window, "location", {
        value: { search: "?perf=1", href: "http://localhost/?perf=1" },
        writable: true,
      });

      const stop = startPerfTimer("event-1");
      stop();
      expect(getPerfEvents()).toHaveLength(1);

      clearPerfEvents();
      expect(getPerfEvents()).toHaveLength(0);
    });
  });
});
