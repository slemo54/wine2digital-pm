# Bolt's Journal - Critical Learnings

## 2025-05-14 - Journal Initialization
**Learning:** Initializing the performance journal to track critical learnings.
**Action:** Will update this journal only with significant performance-related discoveries or failed optimizations.

## 2025-05-14 - Hooks Placement and Early Returns
**Learning:** Placing React Hooks (like `useMemo`) after early return statements (e.g., for loading or auth checks) triggers `react-hooks/rules-of-hooks` lint errors in Next.js components.
**Action:** Always call all hooks unconditionally at the top of the component before any early returns to ensure consistent hook order across renders.
