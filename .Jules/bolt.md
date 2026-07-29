## 2025-05-14 - Unified Dashboard Summary API

**Learning:** The dashboard was suffering from a "network waterfall" by making 5 separate requests for projects, tasks, subtasks, notifications, and activity. This increased total load time and client-side complexity. Aggregating these into a single `/api/dashboard/summary` endpoint using `Promise.allSettled` ensures resilience (one failing part doesn't block the whole dashboard) while significantly reducing network overhead.

**Action:** Prefer unified "summary" or "full" endpoints for main landing pages or complex modals to reduce network round-trips and move data processing to the server.

## 2025-05-14 - Dashboard Memoization

**Learning:** React Query hooks updating in parallel can trigger multiple re-renders. In a complex dashboard like `app/dashboard/page.tsx`, derived data (like `workItems` and `orderedWorkItems`) was being re-computed on every render, including those triggered by irrelevant state changes.

**Action:** Always use `useMemo` for derived arrays and expensive computations in top-level pages. Ensure `new Date()` is also memoized if used as a dependency to avoid lint warnings and unnecessary re-computations.
