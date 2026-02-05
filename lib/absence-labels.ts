/**
 * Centralized absence type labels (Italian translations)
 * Used by both frontend and backend for consistency
 */

export function getAbsenceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    vacation: "Ferie",
    sick_leave: "Malattia",
    personal: "Permesso",
    late_entry: "Ingresso in ritardo",
    early_exit: "Uscita anticipata",
    overtime: "Straordinario",
    transfer: "Trasferta",
    remote: "Smart Working",
    ooo: "Fuori Ufficio",
  };
  return map[type] || type;
}
