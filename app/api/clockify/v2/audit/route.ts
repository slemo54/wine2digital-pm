import { createClockifyAuditRouteHandlers } from "@/lib/clockify-v2-audit-route";
export const dynamic = "force-dynamic";
export const GET = createClockifyAuditRouteHandlers().GET;
