import { createClockifyEntriesRouteHandlers } from "@/lib/clockify-v2-entries-route";

export const dynamic = "force-dynamic";
const handlers = createClockifyEntriesRouteHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;

