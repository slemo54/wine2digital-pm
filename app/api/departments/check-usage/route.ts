import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if ((session?.user as any)?.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const url = new URL(req.url);
        const department = url.searchParams.get("department");

        if (!department) {
            return NextResponse.json({ error: "Department is required" }, { status: 400 });
        }

        const count = await prisma.user.count({
            where: {
                department: department
            }
        });

        return NextResponse.json({ isUsed: count > 0, count });
    } catch (error) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
