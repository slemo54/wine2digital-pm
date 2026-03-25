## 2026-02-12 - Unified Dashboard Summary

**Learning:** Consolidating multiple dashboard data fetches (projects, tasks, subtasks, notifications, activity) into a single API endpoint using `Promise.allSettled` significantly reduces network RTT and browser request waterfalls, especially on slower connections.

**Action:** Always prefer unified "summary" endpoints for initial page loads where multiple distinct data types are required simultaneously. Combine this with `useMemo` in React components to avoid redundant sorting and mapping of the consolidated data on every render.
