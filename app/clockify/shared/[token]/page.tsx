import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClockifyReportError, getClockifyPublicShare } from "@/lib/clockify-v2-reports";
import { isClockifyV2Enabled } from "@/lib/feature-flags";
import SharedClockifyReport from "./shared-report";

export const dynamic = "force-dynamic";

export default async function SharedClockifyReportPage({ params }: { params: { token: string } }): Promise<JSX.Element> {
  if (!isClockifyV2Enabled()) notFound();
  try { const data = await getClockifyPublicShare(prisma, params.token); return <SharedClockifyReport token={params.token} report={(data as any).report} />; }
  catch (error) { if (error instanceof ClockifyReportError) notFound(); throw error; }
}
