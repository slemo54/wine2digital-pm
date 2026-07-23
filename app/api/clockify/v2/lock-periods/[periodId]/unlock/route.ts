import { unlockClockifyPeriodRoute } from "@/lib/clockify-v2-locks-route";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: { periodId: string } }) { return unlockClockifyPeriodRoute(request, params.periodId); }
