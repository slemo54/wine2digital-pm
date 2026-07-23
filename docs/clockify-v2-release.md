# Clockify V2 release and rollback

V2 is disabled unless `NEXT_PUBLIC_CLOCKIFY_V2_ENABLED` is exactly `true`. When it is enabled, `CLOCKIFY_V2_ROLLOUT_STAGE` (or its browser-visible counterpart `NEXT_PUBLIC_CLOCKIFY_V2_ROLLOUT_STAGE`) defaults to `admin`; use `manager`, then `member` only after each cohort is verified. Excluded users continue on legacy `/clockify`; direct V2 APIs return `404`.

## Release order

1. Deploy additive migrations with `npx prisma migrate deploy`, then run `npx prisma generate`.
2. Validate the source file without writes: `npx tsx scripts/import-clockify-projects.ts /secure/Clockify_Time_Report.csv --expected-projects=21 --dry-run`.
3. Import in the maintenance window with the same command without `--dry-run`. The parser validates exact `Project,Client` columns and count before opening a transaction. It never reactivates or changes existing projects.
4. Enable the V2 flag for admins only. Verify entry CRUD/warnings/locks/split, catalog archive history, reports/CSV/shares, and the read-only audit. Advance one cohort per release cycle.
5. Retain legacy Clockify for one complete release cycle before considering a separate retirement decision.

## Rollback

Set `NEXT_PUBLIC_CLOCKIFY_V2_ENABLED` to anything other than literal `true` and redeploy. Do not roll back the additive migrations or imported records; they preserve legacy fields and history. No import runs at startup.
