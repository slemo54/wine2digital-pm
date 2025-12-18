import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getDriveServiceAccountIdentity, verifyDriveServiceAccountAccess } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = ((session.user as any).role as string | undefined) || "member";
  if (role !== "admin") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json({ error: "Missing GOOGLE_DRIVE_FOLDER_ID" }, { status: 500 });
  }

  const identity = await getDriveServiceAccountIdentity().catch((e) => ({
    clientEmail: "unknown",
    projectId: "unknown",
    error: e instanceof Error ? e.message : String(e),
  }));

  const result = await verifyDriveServiceAccountAccess({ folderId });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, folderId, identity, error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, folderId, identity, metadata: result.metadata });
}
