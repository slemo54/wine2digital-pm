import { redirect } from "next/navigation";
import { getClockifyV2Actor } from "@/lib/clockify-v2-api";
import ClockifyAuditClient from "./clockify-audit-client";

export const dynamic = "force-dynamic";
export default async function ClockifyAuditPage(): Promise<JSX.Element> {
  const auth = await getClockifyV2Actor();
  if (!auth.actor) redirect(auth.response?.status === 401 ? "/auth/login" : "/clockify");
  return <ClockifyAuditClient />;
}
