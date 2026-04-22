import { prisma } from "@/lib/prisma";

export const DEFAULT_DEPARTMENTS = ["Backoffice", "IT", "Grafica", "Social"];
export type Department = string;

export async function getDepartments(): Promise<string[]> {
  try {
    const settings = await prisma.workSettings.findFirst({
      select: { departments: true }
    });

    if (settings && settings.departments && settings.departments.length > 0) {
      return settings.departments;
    }
  } catch (error) {
    console.error("Failed to fetch departments from DB, using fallback", error);
  }
  return DEFAULT_DEPARTMENTS;
}

export async function normalizeDepartment(input: unknown): Promise<Department | null> {
  const s = String(input ?? "").trim();
  if (!s) return null;

  const departments = await getDepartments();
  const lowerCaseDepartments = departments.map(d => d.toLowerCase());

  const index = lowerCaseDepartments.indexOf(s.toLowerCase());
  return index !== -1 ? departments[index] : null;
}
