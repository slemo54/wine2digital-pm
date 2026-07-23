export type TaskListDeletionDecision =
  | { ok: true }
  | { ok: false; status: 409; error: string; taskCount: number };

export function decideTaskListDeletion(input: {
  name: string;
  taskCount: number;
}): TaskListDeletionDecision {
  if (input.taskCount > 0) {
    return {
      ok: false,
      status: 409,
      error: "La categoria contiene ancora delle task. Spostale prima di eliminarla.",
      taskCount: input.taskCount,
    };
  }
  return { ok: true };
}
