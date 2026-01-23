export type SubtaskDependencyEdge = {
  subtaskId: string;
  dependsOnId: string;
};

export type SubtaskDependencyValidationError =
  | "missing_depends_on"
  | "self_dependency"
  | "cross_task"
  | "cycle";

export type SubtaskDependencyValidationResult =
  | { ok: true }
  | { ok: false; error: SubtaskDependencyValidationError };

export function validateSubtaskDependencyCreation(args: {
  subtaskId: string;
  dependsOnId: string;
  subtaskTaskId: string;
  dependsOnTaskId: string;
  existingEdges: readonly SubtaskDependencyEdge[];
}): SubtaskDependencyValidationResult {
  const subtaskId = String(args.subtaskId || "").trim();
  const dependsOnId = String(args.dependsOnId || "").trim();
  if (!dependsOnId) return { ok: false, error: "missing_depends_on" };
  if (!subtaskId) return { ok: false, error: "missing_depends_on" };

  if (subtaskId === dependsOnId) return { ok: false, error: "self_dependency" };
  if (String(args.subtaskTaskId) !== String(args.dependsOnTaskId)) return { ok: false, error: "cross_task" };

  // Cycle prevention: if dependsOnId already (transitively) depends on subtaskId, we'd create a cycle.
  const edges = new Map<string, string[]>();
  for (const d of args.existingEdges) {
    const from = String(d.subtaskId || "").trim();
    const to = String(d.dependsOnId || "").trim();
    if (!from || !to) continue;
    const list = edges.get(from) || [];
    list.push(to);
    edges.set(from, list);
  }

  const visited = new Set<string>();
  const stack: string[] = [dependsOnId];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (cur === subtaskId) return { ok: false, error: "cycle" };
    if (visited.has(cur)) continue;
    visited.add(cur);
    const next = edges.get(cur) || [];
    for (const n of next) stack.push(n);
  }

  return { ok: true };
}

