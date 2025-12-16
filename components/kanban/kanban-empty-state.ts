import type { I18nKey } from "@/lib/i18n";

export type KanbanStatus = "todo" | "in_progress" | "done";

export type KanbanEmptyStateModel = {
  icon: "todo" | "in_progress" | "done";
  titleKey: I18nKey;
  bodyKey: I18nKey;
  ctaKey: I18nKey;
};

export function getKanbanEmptyState(status: string): KanbanEmptyStateModel | null {
  if (status === "todo") {
    return {
      icon: "todo",
      titleKey: "kanban.empty.todo.title",
      bodyKey: "kanban.empty.todo.body",
      ctaKey: "kanban.empty.cta",
    };
  }
  if (status === "in_progress") {
    return {
      icon: "in_progress",
      titleKey: "kanban.empty.in_progress.title",
      bodyKey: "kanban.empty.in_progress.body",
      ctaKey: "kanban.empty.cta",
    };
  }
  if (status === "done") {
    return {
      icon: "done",
      titleKey: "kanban.empty.done.title",
      bodyKey: "kanban.empty.done.body",
      ctaKey: "kanban.empty.cta",
    };
  }
  return null;
}


