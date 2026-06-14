## 2025-03-24 - Unified Dashboard Summary Endpoint
**Learning:** Consolidating multiple API calls into a single unified endpoint significantly reduces client-side waterfalls and HTTP overhead, but requires careful data reconstruction in the client-side hook to maintain compatibility with existing UI components that expect specific nested structures.
**Action:** When creating batch endpoints, return flat data from the server for efficiency, but ensure the frontend hook (e.g., useDashboardData) reshapes the data to match the legacy contract to avoid breaking existing pages.
