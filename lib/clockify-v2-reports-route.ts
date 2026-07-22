import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { clockifyV2Error, clockifyV2ServerError, getClockifyV2Actor, parseClockifyV2Json } from "./clockify-v2-api";
import { ClockifyReportError, createClockifyReportShare, exportClockifyReportCsv, getClockifyPublicShare, listClockifyReportShares, normalizeClockifyReportInput, revokeClockifyReportShare, runClockifyReport } from "./clockify-v2-reports";

type ReportDependencies = { getActor: typeof getClockifyV2Actor; run: typeof runClockifyReport; exportCsv: typeof exportClockifyReportCsv };
type ShareDependencies = { getActor: typeof getClockifyV2Actor; create: typeof createClockifyReportShare; list: typeof listClockifyReportShares; revoke: typeof revokeClockifyReportShare };
const reportDefaults: ReportDependencies = { getActor: getClockifyV2Actor, run: runClockifyReport, exportCsv: exportClockifyReportCsv };
const shareDefaults: ShareDependencies = { getActor: getClockifyV2Actor, create: createClockifyReportShare, list: listClockifyReportShares, revoke: revokeClockifyReportShare };

function reportError(error: unknown): NextResponse {
  return error instanceof ClockifyReportError ? clockifyV2Error(error.status, error.message) : clockifyV2ServerError(error);
}
function paramsFor(request: Request): Record<string, unknown> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return { ...params, reportType: params.reportType || params.type };
}

export function createClockifyReportRouteHandlers(overrides: Partial<ReportDependencies> = {}): { GET: (request: Request) => Promise<NextResponse>; CSV: (request: Request) => Promise<NextResponse> } {
  const dependencies = { ...reportDefaults, ...overrides };
  async function report(request: Request): Promise<unknown> { const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!; return dependencies.run(prisma, auth.actor, normalizeClockifyReportInput(paramsFor(request))); }
  return {
    async GET(request): Promise<NextResponse> { try { const result = await report(request); return result instanceof NextResponse ? result : NextResponse.json(result); } catch (error) { return reportError(error); } },
    async CSV(request): Promise<NextResponse> { try { const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!; const input = normalizeClockifyReportInput(paramsFor(request)); return new NextResponse(await dependencies.exportCsv(prisma, auth.actor, input), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=clockify-report.csv", "Cache-Control": "no-store" } }); } catch (error) { return reportError(error); } },
  };
}

export function createClockifyReportShareRouteHandlers(overrides: Partial<ShareDependencies> = {}): { GET: (request: Request) => Promise<NextResponse>; POST: (request: Request) => Promise<NextResponse>; REVOKE: (request: Request, id: string) => Promise<NextResponse> } {
  const dependencies = { ...shareDefaults, ...overrides };
  return {
    async GET(_: Request): Promise<NextResponse> { try { const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!; return NextResponse.json({ shares: await dependencies.list(prisma, auth.actor) }); } catch (error) { return reportError(error); } },
    async POST(request: Request): Promise<NextResponse> { try { const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!; const share = await dependencies.create(prisma, auth.actor, await parseClockifyV2Json(request)); return NextResponse.json(share, { status: 201, headers: { "Cache-Control": "no-store" } }); } catch (error) { return reportError(error); } },
    async REVOKE(_: Request, id: string): Promise<NextResponse> { try { const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!; await dependencies.revoke(prisma, auth.actor, id); return new NextResponse(null, { status: 204 }); } catch (error) { return reportError(error); } },
  };
}

/** No session is consulted here: the stored author's current active role and scope are checked by the service for every request. */
export async function publicClockifyReportShareRoute(_: Request, token: string, load: typeof getClockifyPublicShare = getClockifyPublicShare): Promise<NextResponse> {
  try { return NextResponse.json(await load(prisma, token), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return error instanceof ClockifyReportError ? clockifyV2Error(error.status, error.message) : clockifyV2Error(404, "Share not found"); }
}
