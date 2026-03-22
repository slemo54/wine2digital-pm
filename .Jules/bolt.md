## 2026-03-03 - Unified Dashboard Summary API
**Learning:** Consolidating multiple API requests into a single unified endpoint using Prisma and `Promise.allSettled` significantly reduces network overhead and improves perceived performance, especially when some data sources might be slow or unreliable. Parallelizing these queries on the server is much more efficient than parallelizing them on the client.
**Action:** Always look for "waterfall" or "scattered" data fetching patterns in key pages like the Dashboard and consider implementing a unified summary endpoint.

## 2026-03-03 - Memoizing Derived View Data
**Learning:** In React components that derive complex arrays (like merging tasks and subtasks and then sorting them) on every render, using `useMemo` is critical to maintain UI responsiveness, especially when these computations depend on the current time which might trigger redundant re-renders if not handled carefully.
**Action:** Wrap complex array transformations and time-dependent logic in `useMemo` to ensure stable references and avoid unnecessary computations.
