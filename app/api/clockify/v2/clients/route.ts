import { createClientsRouteHandlers } from "@/lib/clockify-v2-clients-route";

export const dynamic = "force-dynamic";

const handlers = createClientsRouteHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;
