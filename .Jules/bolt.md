## 2026-03-27 - Consolidated Dashboard API
**Learning:** Consolidating multiple dashboard requests into a single API endpoint significantly reduces HTTP overhead and improves Time-to-Interactive. Using `Promise.allSettled` on the server ensures that one failing query (e.g., activity feed) doesn't block the entire dashboard from loading.
**Action:** Always prefer unified "summary" endpoints for data-heavy landing pages. Ensure the API response structure is carefully mapped in the frontend hook to maintain compatibility with existing component prop types.
