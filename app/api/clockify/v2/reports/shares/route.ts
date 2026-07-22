import { createClockifyReportShareRouteHandlers } from "@/lib/clockify-v2-reports-route";

export const dynamic = "force-dynamic";
const handlers = createClockifyReportShareRouteHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
