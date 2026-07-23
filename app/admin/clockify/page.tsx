import { redirect } from "next/navigation";
import { getClockifyV2CatalogActor } from "@/lib/clockify-v2-api";
import ClockifyCatalogPage from "./clockify-catalog-page";

export const dynamic = "force-dynamic";

export default async function AdminClockifyPage(): Promise<JSX.Element> {
  const auth = await getClockifyV2CatalogActor();
  if (!auth.actor || auth.actor.role === "member") redirect(auth.response?.status === 401 ? "/auth/login" : "/dashboard");
  return <ClockifyCatalogPage role={auth.actor.role} />;
}
