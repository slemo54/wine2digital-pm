import { prisma } from "@/lib/prisma";

/**
 * Find users who should be notified about a new absence request (pending status)
 * Returns only user IDs for in-app notifications
 */
export async function findAbsenceRequestRecipients(opts: {
  requesterUserId: string;
  requesterDepartment?: string | null;
}): Promise<string[]> {
  const recipients = await findAbsenceRequestRecipientsWithEmails(opts);
  return recipients.map((r) => r.id);
}

/**
 * Find users who should be notified about a new absence request
 * Returns full user objects with email for email notifications
 *
 * Logic:
 * - All admins receive notifications
 * - Managers in the same department as requester receive notifications
 * - Requester is excluded
 */
export async function findAbsenceRequestRecipientsWithEmails(opts: {
  requesterUserId: string;
  requesterDepartment?: string | null;
}): Promise<Array<{ id: string; email: string; name: string | null }>> {
  const { requesterUserId, requesterDepartment } = opts;

  const recipients = await prisma.user.findMany({
    where: {
      AND: [
        // Exclude the requester
        { id: { not: requesterUserId } },
        // Include admins OR managers in same department
        {
          OR: [
            // All admins
            { role: "admin" },
            // Managers in same department (only if department is set)
            ...(requesterDepartment
              ? [
                  {
                    role: "manager",
                    department: requesterDepartment,
                  },
                ]
              : []),
          ],
        },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  return recipients;
}
