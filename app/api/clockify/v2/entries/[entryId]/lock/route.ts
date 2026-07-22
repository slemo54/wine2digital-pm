import { createClockifyEntryLockRouteHandlers } from "@/lib/clockify-v2-locks-route";
export const dynamic = "force-dynamic";
const handlers = createClockifyEntryLockRouteHandlers();
export async function POST(request: Request, { params }: { params: { entryId: string } }) { return handlers.POST(request, params.entryId); }
export async function DELETE(request: Request, { params }: { params: { entryId: string } }) { return handlers.DELETE(request, params.entryId); }
