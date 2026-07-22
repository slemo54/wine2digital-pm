import { redirect } from "next/navigation";
import { isClockifyEnabled, isClockifyV2Enabled } from "@/lib/feature-flags";
import ClockifyClientPage from "./clockify-client-page";
import ClockifyV2ClientPage from "./clockify-v2-client-page";

export const dynamic = "force-dynamic";

export default function ClockifyPage() {
  if (!isClockifyEnabled()) {
    redirect("/dashboard");
  }
  return isClockifyV2Enabled() ? <ClockifyV2ClientPage /> : <ClockifyClientPage />;
}
