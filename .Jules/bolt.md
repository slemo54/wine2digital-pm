## 2026-03-24 - Unified Dashboard API

**Learning:** Consolidating multiple dashboard API calls (projects, tasks, subtasks, notifications, activity) into a single unified endpoint significantly reduces network overhead and waterfall latency. Using `Promise.allSettled` on the server ensures that a failure in one data source (e.g., activity feed) doesn't block the entire response, maintaining dashboard resilience.

**Action:** When refactoring multiple individual data hooks into a unified one, ensure the hook performs data reconstruction (e.g., re-wrapping arrays into objects) to maintain compatibility with legacy components that expect a specific nested structure.
