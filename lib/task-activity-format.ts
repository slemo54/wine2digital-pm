import { format } from "date-fns";
import { it } from "date-fns/locale";

export type TaskActivityActor = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
};

export type TaskActivityEvent = {
  id: string;
  type: string;
  createdAt: string;
  actor: TaskActivityActor | null;
  metadata: any;
};

function statusLabel(status: string): string {
  switch (status) {
    case "todo":
      return "Da fare";
    case "in_progress":
      return "In corso";
    case "done":
      return "Completato";
    default:
      return status;
  }
}

function priorityLabel(priority: string): string {
  switch (priority) {
    case "high":
      return "Alta";
    case "medium":
      return "Media";
    case "low":
      return "Bassa";
    default:
      return priority;
  }
}

function formatDateOrNone(isoOrNull: unknown): string {
  if (typeof isoOrNull !== "string" || !isoOrNull) return "nessuna";
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return "nessuna";
  return format(d, "PPP", { locale: it });
}

export function formatTaskActivityEvent(
  e: TaskActivityEvent,
  resolveUserName?: (userId: string) => string | null
): { message: string } {
  const meta = e.metadata || {};

  switch (e.type) {
    case "task.status_changed":
      return {
        message: `ha cambiato lo status da ${statusLabel(String(meta.from || ""))} a ${statusLabel(
          String(meta.to || "")
        )}`,
      };
    case "task.priority_changed":
      return {
        message: `ha cambiato la priorità da ${priorityLabel(String(meta.from || ""))} a ${priorityLabel(
          String(meta.to || "")
        )}`,
      };
    case "task.due_date_changed":
      return {
        message: `ha cambiato la scadenza da ${formatDateOrNone(meta.from)} a ${formatDateOrNone(meta.to)}`,
      };
    case "task.title_changed":
      return { message: "ha aggiornato il titolo" };
    case "task.description_changed":
      return { message: "ha aggiornato la descrizione" };
    case "task.list_changed":
      return { message: "ha aggiornato la lista" };
    case "task.story_points_changed":
      return { message: "ha aggiornato gli story points" };
    case "task.tags_changed":
      return { message: "ha aggiornato i tag" };
    case "task.assignees_changed": {
      const from = Array.isArray(meta.from) ? (meta.from as string[]) : [];
      const to = Array.isArray(meta.to) ? (meta.to as string[]) : [];
      const fromNames = resolveUserName
        ? from.map((id) => resolveUserName(id)).filter((x): x is string => !!x)
        : [];
      const toNames = resolveUserName
        ? to.map((id) => resolveUserName(id)).filter((x): x is string => !!x)
        : [];

      if (fromNames.length || toNames.length) {
        return {
          message: `ha aggiornato gli assegnatari (${fromNames.join(", ") || "nessuno"} → ${
            toNames.join(", ") || "nessuno"
          })`,
        };
      }
      return { message: "ha aggiornato gli assegnatari" };
    }
    case "task.comment_added":
      return { message: "ha aggiunto un commento" };
    case "task.attachment_uploaded":
      return { message: `ha caricato un allegato${meta.fileName ? `: ${String(meta.fileName)}` : ""}` };
    case "task.subtask_added":
      return { message: `ha aggiunto un subtask${meta.title ? `: ${String(meta.title)}` : ""}` };
    case "task.subtask_updated":
      if (typeof meta.completed === "boolean") {
        return { message: meta.completed ? "ha completato un subtask" : "ha riaperto un subtask" };
      }
      return { message: "ha aggiornato un subtask" };
    case "task.subtask_deleted":
      return { message: "ha eliminato un subtask" };
    default:
      return { message: "ha eseguito un aggiornamento" };
  }
}


