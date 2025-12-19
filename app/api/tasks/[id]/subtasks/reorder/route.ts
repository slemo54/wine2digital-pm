import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { subtaskIds } = await request.json();

        if (!Array.isArray(subtaskIds)) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        // Transaction to update positions
        await prisma.$transaction(
            subtaskIds.map((id, index) =>
                prisma.subtask.update({
                    where: { id },
                    data: { position: index },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error reordering subtasks:", error);
        return NextResponse.json(
            { error: "Failed to reorder subtasks" },
            { status: 500 }
        );
    }
}
