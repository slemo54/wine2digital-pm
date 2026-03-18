## 2026-02-27 - Unified Dashboard Summary API
**Learning:** Consolidating multiple API fetches into a single "Summary" endpoint significantly reduces network overhead and database connection churn. Using `Promise.allSettled` instead of `Promise.all` ensures that a single non-critical query failure (like activity or notifications) doesn't prevent the entire dashboard from loading.
**Action:** Prefer unified endpoints for initial page loads with multiple data requirements. Always wrap parallel fetches in `Promise.allSettled` for better frontend resilience.
