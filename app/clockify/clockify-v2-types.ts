export type ClockifyV2Task = { id: string; name: string; isActive?: boolean };
export type ClockifyV2Project = { id: string; name: string; client: string; clientId: string | null; color: string; isActive?: boolean; tasks: ClockifyV2Task[] };
export type ClockifyV2Warning = { code: string; message: string };
export type ClockifyV2Entry = {
  id: string; userId: string; projectId: string; taskId: string | null; description: string; task: string | null; tags: string[]; billable: boolean;
  workDate: string; startAt: string; endAt: string; durationMin: number; lockedAt: string | null; lockKind: string | null;
  user?: { id: string; name: string | null; email: string; department: string | null };
  project?: { id: string; name: string; client: string; isActive: boolean; color: string };
  clockifyTask?: ClockifyV2Task | null;
};

export type ClockifyV2Form = { projectId: string; taskId: string; description: string; tags: string; billable: boolean; date: string; startTime: string; endAt: string; durationMin: string; mode: "end" | "duration" };
