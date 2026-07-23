import { publicClockifyReportShareRoute } from "@/lib/clockify-v2-reports-route";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { token: string } }) { return publicClockifyReportShareRoute(request, params.token); }
