# Bolt's Performance Journal

## 2026-03-14 - Unified Dashboard API
**Learning:** Consolidating multiple API calls into a single "summary" or "full" endpoint significantly reduces network overhead and improves perceived performance, especially for landing pages like the Dashboard. It also simplifies client-side state management by providing a single source of truth for the page's data.
**Action:** Always look for "waterfall" API patterns where a component or page triggers multiple independent requests that could be fetched in parallel on the server. Consolidate these into unified endpoints.
