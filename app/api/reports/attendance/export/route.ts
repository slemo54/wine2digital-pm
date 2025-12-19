import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const userId = (session.user as any).id;
        const userRole = (session.user as any).role;

        // Only Admin/Manager can export all. Users export their own.
        const canExportAll = userRole === "admin" || userRole === "manager";

        // Filters could be applied here (startDate, endDate, department)
        const where: any = {};
        if (!canExportAll) {
            where.userId = userId;
        }

        const entries = await prisma.timeEntry.findMany({
            where,
            include: {
                user: {
                    select: { firstName: true, lastName: true, email: true, department: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        // Manual CSV generation
        const header = ["Date", "Employee", "Department", "Clock In", "Clock Out", "Total Minutes", "Overtime", "Status"].join(",");
        const rows = entries.map(e => {
            const name = `${e.user.firstName || ''} ${e.user.lastName || ''}`.trim() || e.user.email;
            const date = format(new Date(e.date), "yyyy-MM-dd");
            const clockIn = e.clockIn ? format(new Date(e.clockIn), "HH:mm:ss") : "";
            const clockOut = e.clockOut ? format(new Date(e.clockOut), "HH:mm:ss") : "";

            return [
                date,
                `"${name}"`,
                `"${e.user.department || ''}"`,
                clockIn,
                clockOut,
                e.totalMinutes,
                e.overtimeMinutes,
                e.status
            ].join(",");
        });

        const csvContent = [header, ...rows].join("\n");

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="attendance_report_${format(new Date(), "yyyyMMdd")}.csv"`,
            },
        });

    } catch (error) {
        console.error("CSV Export error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
