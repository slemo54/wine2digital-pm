## 2026-03-15 - Unified Dashboard Summary

**Learning:** Consolidating multiple related API calls (projects, tasks, subtasks, notifications, activity) into a single `/api/dashboard/summary` endpoint significantly reduces network RTT (Round Trip Time) and connection overhead, especially on high-latency connections. Using `Promise.all` on the server ensures these queries run in parallel, maximizing database efficiency.

**Action:** Look for "waterfall" fetching patterns in dashboard or detail pages and replace them with unified endpoints that leverage Prisma's parallel execution capabilities.

## 2026-03-15 - Frontend Memoization for Derived Lists

**Learning:** Processing and sorting arrays (like merging tasks and subtasks into `workItems`) inside the render loop causes performance degradation as the list grows, even if the underlying data hasn't changed. This is particularly noticeable when other UI states (like dialogs) trigger re-renders.

**Action:** Always wrap non-trivial data transformations (map, filter, sort) in `useMemo` when they depend on API data or props.
