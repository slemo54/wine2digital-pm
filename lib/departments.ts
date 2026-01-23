export const DEPARTMENTS = ["Backoffice", "IT", "Grafica", "Social"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export function normalizeDepartment(input: unknown): Department | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  return (DEPARTMENTS as readonly string[]).includes(s) ? (s as Department) : null;
}

