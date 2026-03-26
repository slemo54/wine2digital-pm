## 2026-03-26 - Unified Dashboard Summary API
**Learning:** Consolidated dashboard API reduces RTT and DB connections, but requires careful matching of response structures. Even if individual hooks are modified, they must point to valid endpoints.
**Action:** Always verify the existence of API endpoints before updating hooks. Use confirmed parameters like `scope=assigned` instead of assuming sub-routes.
