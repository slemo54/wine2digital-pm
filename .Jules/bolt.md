## 2024-05-15 - Unified Dashboard Summary Pattern

**Learning:** Consolidating multiple dashboard API calls (projects, tasks, subtasks, notifications, activity) into a single server-side `Promise.allSettled` endpoint reduces HTTP overhead by 80% and ensures atomic UI updates. It also serves as a central point to fix disparate query logic and broken API paths (e.g., `/api/tasks/my-tasks` vs `/api/tasks?scope=assigned`).

**Action:** Prefer "Summary" or "Full" endpoints for high-traffic, multi-resource views (Dashboards, Detail Modals) instead of relying on multiple parallel client-side fetches.
