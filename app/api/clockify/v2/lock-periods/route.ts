import { createClockifyLockPeriodsRouteHandlers } from "@/lib/clockify-v2-locks-route";
export const dynamic = "force-dynamic";
const handlers = createClockifyLockPeriodsRouteHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
