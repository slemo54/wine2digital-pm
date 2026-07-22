import { redirect } from "next/navigation";
import { isClockifyV2Enabled } from "@/lib/feature-flags";
import { getSessionUser } from "@/lib/session-user";
import { normalizeClockifyRole } from "@/lib/clockify-v2-api";
import ClockifyCatalogPage from "./clockify-catalog-page";

export const dynamic = "force-dynamic";

export default async function AdminClockifyPage(): Promise<JSX.Element> {
  if (!isClockifyV2Enabled()) redirect("/dashboard");
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  const role = normalizeClockifyRole(user.globalRole);
  if (role !== "admin" && role !== "manager") redirect("/dashboard");
  return <ClockifyCatalogPage role={role} />;
}
