import { redirect } from "next/navigation";
import { isClockifyEnabled, isClockifyV2Enabled } from "@/lib/feature-flags";
import { getClockifyV2Actor } from "@/lib/clockify-v2-api";
import ClockifyClientPage from "./clockify-client-page";
import ClockifyV2ClientPage from "./clockify-v2-client-page";

export const dynamic = "force-dynamic";

export default async function ClockifyPage() {
  if (!isClockifyEnabled()) {
    redirect("/dashboard");
  }
  if (!isClockifyV2Enabled()) return <ClockifyClientPage />;
  const auth = await getClockifyV2Actor();
  return auth.actor ? <ClockifyV2ClientPage /> : <ClockifyClientPage />;
}
