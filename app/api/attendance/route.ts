import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { startOfDay, differenceInMinutes, parse, format } from "date-fns";

export const dynamic = "force-dynamic";

// Helper to get or create daily entry
async function getTodaysEntry(userId: string) {
    const today = startOfDay(new Date());
    return await prisma.timeEntry.findUnique({
        where: {
            userId_date: {
                userId,
                date: today,
            },
        },
    });
}

// Helper to get global settings
async function getWorkSettings() {
    const settings = await prisma.workSettings.findFirst();
    return (
        settings || {
            standardStartTime: "09:00",
            standardEndTime: "18:00",
            breakDurationMin: 60,
            lateToleranceMin: 15,
        }
    );
}

// GET - Get today's status
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const entry = await getTodaysEntry(userId);

        return NextResponse.json({ entry });
    } catch (error) {
        console.error("Attendance GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST - Clock In / Out
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const body = await req.json();
        const { action } = body; // 'clock-in', 'clock-out'
        const now = new Date();
        const today = startOfDay(now);

        const settings = await getWorkSettings();

        // Find or create entry for today
        let entry = await prisma.timeEntry.upsert({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
            update: {},
            create: {
                userId,
                date: today,
                status: "present",
            },
        });

        if (action === "clock-in") {
            if (entry.clockIn) {
                return NextResponse.json({ error: "Already clocked in" }, { status: 400 });
            }

            // Late Calculation
            const standardStart = parse(settings.standardStartTime, "HH:mm", now);
            const diffMinutes = differenceInMinutes(now, standardStart);
            const isLate = diffMinutes > settings.lateToleranceMin;

            entry = await prisma.timeEntry.update({
                where: { id: entry.id },
                data: {
                    clockIn: now,
                    isLate,
                },
            });
        } else if (action === "clock-out") {
            // Allow clock out even if already clocked out (maybe updating time? No, simple logic for now)
            if (!entry.clockIn) {
                return NextResponse.json({ error: "Must clock in first" }, { status: 400 });
            }

            // Early Exit & Overtime Calculations
            const standardEnd = parse(settings.standardEndTime, "HH:mm", now);
            const minutesUntilEnd = differenceInMinutes(standardEnd, now);
            const isEarlyExit = minutesUntilEnd > 15; // 15 min tolerance for early exit too or strict?

            // Total minutes worked
            const grossMinutes = differenceInMinutes(now, entry.clockIn);
            // Subtract break if worked enough (mock logic: if > 5 hours, subtract break)
            const effectiveBreak = grossMinutes > 300 ? settings.breakDurationMin : 0;
            const netMinutes = Math.max(0, grossMinutes - effectiveBreak);

            // Overtime (anything more than standard day length?)
            // Standard day = (End - Start) - Break
            const standardStart = parse(settings.standardStartTime, "HH:mm", now);
            const standardDayMinutes = differenceInMinutes(standardEnd, standardStart) - settings.breakDurationMin;
            const overtimeMinutes = Math.max(0, netMinutes - standardDayMinutes);

            entry = await prisma.timeEntry.update({
                where: { id: entry.id },
                data: {
                    clockOut: now,
                    isEarlyExit,
                    breakDuration: effectiveBreak,
                    totalMinutes: netMinutes,
                    overtimeMinutes,
                },
            });
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ entry });
    } catch (error) {
        console.error("Attendance POST error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
