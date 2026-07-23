import { createClockifyReportRouteHandlers } from "@/lib/clockify-v2-reports-route";

export const dynamic = "force-dynamic";
const handlers = createClockifyReportRouteHandlers();
export const GET = handlers.GET;
