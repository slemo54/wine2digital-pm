import { prisma } from "@/lib/prisma";

export async function updateTaskProgress(taskId: string) {
    const subtasks = await prisma.subtask.findMany({
        where: { taskId },
        select: { status: true, completed: true }
    });

    if (subtasks.length === 0) {
        // No subtasks? Maybe progress is 0 or 100 based on task status?
        // For now, let's leave it alone or set to 0. 
        // Actually, usually 0 if no subtasks.
        return;
    }

    const total = subtasks.length;
    // Count done or completed
    const completedCount = subtasks.filter(s => s.status === 'done' || s.completed).length;

    // You might want to store this in Task model if you have a progress field.
    // The current Task model doesn't have a 'progress' percentage field, only 'status'.
    // We can verify if we need to add 'progress' Int field to Task or just rely on dynamic calc.
    // The plan said: "Auto-Calculation: Task Percent Complete".
    // If we want to show it, we should probably add it to the model OR just return it in the API.
    // Let's assume we maintain it on the Task model for sorting/filtering properly later.
    // But wait, schema.prisma doesn't have 'progress' field on Task. 
    // I should check schema.
}
