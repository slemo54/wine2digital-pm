import { Prisma } from "@prisma/client";

/**
 * Builds the Prisma 'where' clause for absence visibility based on user role and department.
 * 
 * Admin: sees everything.
 * Manager: sees own absences + absences of users in the same department.
 * Member: sees only own absences.
 */
export function buildAbsenceVisibilityWhere(params: {
  role: string;
  userId: string;
  department?: string | null;
}): Prisma.AbsenceWhereInput {
  const { role, userId, department } = params;
  const normalizedRole = role.toLowerCase();

  if (normalizedRole === "admin") {
    return {};
  }

  if (normalizedRole === "manager") {
    // If manager has no department, they only see their own
    if (!department) {
      return { userId };
    }

    return {
      OR: [
        { userId },
        {
          user: {
            department: department,
          },
        },
      ],
    };
  }

  // Default: member only sees own
  return { userId };
}

/**
 * Checks if an actor can approve/reject/edit an absence of a target user.
 * 
 * Admin: can decide on any absence.
 * Manager: can decide only if target user is in the same department.
 * Member: cannot decide on any absence (except maybe their own if we allowed editing pending ones, 
 * but the request focuses on approval logic).
 */
export function canDecideAbsence(params: {
  actorRole: string;
  actorDepartment?: string | null;
  targetDepartment?: string | null;
}): boolean {
  const { actorRole, actorDepartment, targetDepartment } = params;
  const normalizedRole = actorRole.toLowerCase();

  if (normalizedRole === "admin") {
    return true;
  }

  if (normalizedRole === "manager") {
    // Manager can only decide if they have a department and it matches the target user's department
    return !!actorDepartment && actorDepartment === targetDepartment;
  }

  return false;
}
