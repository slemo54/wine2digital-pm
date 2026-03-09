## 2026-05-22 - Optimize Project List API with DB-side Processing
**Learning:** Performing search, sorting, and pagination in-memory in the application layer for list-fetching APIs is a major bottleneck as data grows. Moving these operations to the database using Prisma's `contains`, `orderBy`, `skip`, and `take` significantly reduces server memory usage and improves response times.
**Action:** Always prioritize database-level operations for list-fetching endpoints. Use Prisma's `_count` aggregation instead of fetching all related records to compute metrics like completion rates.
