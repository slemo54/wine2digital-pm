# Bolt's Journal - Critical Learnings

This journal contains critical learnings from performance optimization tasks.

## 2026-02-12 - Initial Entry
**Learning:** Unified API endpoints (like `/api/tasks/[id]/full`) are effective for reducing client-side waterfalls, but should be comprehensive enough to include project-level metadata if that metadata is required for the component to be fully functional without additional requests.
**Action:** Always check if a "unified" endpoint is missing related data that forces the client to still make secondary requests.
