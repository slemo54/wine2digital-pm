## 2025-05-15 - [Dashboard Performance Consolidation]
**Learning:** Consolidating multiple related API calls into a single 'summary' endpoint significantly reduces network overhead and waterfall effects on the dashboard. Combining this with `useMemo` for derived data in the frontend prevents redundant computations and re-renders, further smoothing the user experience.
**Action:** Always look for patterns where a page performs 3+ concurrent API calls on mount and consider creating a unified 'full' or 'summary' endpoint to optimize perceived performance.
