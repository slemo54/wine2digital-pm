import { createClockifyReportShareRouteHandlers } from "@/lib/clockify-v2-reports-route";

export const dynamic = "force-dynamic";
const handlers = createClockifyReportShareRouteHandlers();
export async function POST(request: Request, { params }: { params: { shareId: string } }) { return handlers.REVOKE(request, params.shareId); }
