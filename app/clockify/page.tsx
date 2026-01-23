import { redirect } from "next/navigation";
import { isClockifyEnabled } from "@/lib/feature-flags";
import ClockifyClientPage from "./clockify-client-page";

export const dynamic = "force-dynamic";

export default function ClockifyPage() {
  if (!isClockifyEnabled()) {
    redirect("/dashboard");
  }
  return <ClockifyClientPage />;
}

