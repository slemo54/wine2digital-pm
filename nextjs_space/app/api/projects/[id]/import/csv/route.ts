import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parse } from 'csv-parse/sync';

export const dynamic = 'force-dynamic';

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = params.id;
        const { csvData, mapping } = await req.json();

        if (!csvData || !mapping) {
            return NextResponse.json({ error: 'csvData and mapping are required' }, { status: 400 });
        }

        // Parse CSV
        const records = parse(csvData, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        // Get project custom fields to map IDs
        const customFields = await prisma.customField.findMany({
            where: { projectId },
        });

        const fieldMap = new Map(customFields.map(f => [f.name, f.id]));

        let count = 0;

        // Use transaction for better performance/reliability if possible, 
        // but with potentially large files, we might want to do it in chunks.
        // For simplicity, we'll do it sequentially for now or a small balance.

        for (const record of records) {
            const title = record[Object.keys(mapping).find(h => mapping[h] === "title")!] || "Untitled Task";
            const description = record[Object.keys(mapping).find(h => mapping[h] === "description")!] || "";
            const status = (record[Object.keys(mapping).find(h => mapping[h] === "status")!] || "todo").toLowerCase();
            const priority = (record[Object.keys(mapping).find(h => mapping[h] === "priority")!] || "medium").toLowerCase();
            const dueDateRaw = record[Object.keys(mapping).find(h => mapping[h] === "dueDate")!];

            // Handle List/Category
            let listId: string | null = null;
            const listName = record[Object.keys(mapping).find(h => mapping[h] === "list")!];
            if (listName) {
                const list = await prisma.taskList.upsert({
                    where: { projectId_name: { projectId, name: listName } },
                    update: {},
                    create: { projectId, name: listName }
                });
                listId = list.id;
            }

            // Create Task
            const task = await prisma.task.create({
                data: {
                    projectId,
                    title,
                    description,
                    status: ["todo", "in_progress", "done", "archived"].includes(status) ? status : "todo",
                    priority: ["high", "medium", "low"].includes(priority) ? priority : "medium",
                    dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
                    listId,
                }
            });

            // Handle Custom Fields
            const customEntries = Object.entries(mapping).filter(([_, target]) => target === "custom");
            for (const [header, _] of customEntries) {
                const val = record[header];
                const fieldId = fieldMap.get(header);
                if (fieldId && val) {
                    await prisma.customFieldValue.create({
                        data: {
                            taskId: task.id,
                            customFieldId: fieldId,
                            value: String(val)
                        }
                    });
                }
            }

            count++;
        }

        return NextResponse.json({ success: true, count });
    } catch (error) {
        console.error('CSV import error:', error);
        return NextResponse.json({ error: (error as any).message || 'Internal server error' }, { status: 500 });
    }
}
