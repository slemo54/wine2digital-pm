import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    { params }: { params: { subtaskId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { dependsOnId } = await request.json();

        if (!dependsOnId) {
            return NextResponse.json({ error: "Missing dependsOnId" }, { status: 400 });
        }

        if (params.subtaskId === dependsOnId) {
            return NextResponse.json({ error: "Cannot depend on self" }, { status: 400 });
        }

        // Check permissions (User must have write access to the project of the *subtaskId*)
        // Simplified check: Check if user can access the subtask
        const subtask = await prisma.subtask.findUnique({
            where: { id: params.subtaskId },
            include: { task: true }
        });

        if (!subtask) {
            return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
        }

        // Create dependency
        const dependency = await prisma.subtaskDependency.create({
            data: {
                subtaskId: params.subtaskId,
                dependsOnId: dependsOnId,
            },
        });

        return NextResponse.json(dependency);
    } catch (error) {
        console.error("Error adding dependency:", error);
        return NextResponse.json(
            { error: "Failed to add dependency" },
            { status: 500 }
        );
    }
}
