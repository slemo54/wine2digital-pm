import { redirect } from "next/navigation";
import { getClockifyV2Actor } from "@/lib/clockify-v2-api";
import ClockifyReportsClient from "./reports-client";

export const dynamic = "force-dynamic";

export default async function ClockifyReportsPage(): Promise<JSX.Element> {
  const auth = await getClockifyV2Actor();
  if (!auth.actor) redirect(auth.response?.status === 401 ? "/auth/login" : "/dashboard");
  return <ClockifyReportsClient />;
}
