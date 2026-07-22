import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClockifyReportError, getClockifyPublicShare } from "@/lib/clockify-v2-reports";
import SharedClockifyReport from "./shared-report";

export const dynamic = "force-dynamic";

export default async function SharedClockifyReportPage({ params }: { params: { token: string } }): Promise<JSX.Element> {
  try { const data = await getClockifyPublicShare(prisma, params.token); return <SharedClockifyReport token={params.token} report={(data as any).report} />; }
  catch (error) { if (error instanceof ClockifyReportError) notFound(); throw error; }
}
