export type ClockifyClient = { id: string; name: string };
export type ClockifyManager = { id: string; name: string | null; email: string; role: string };
export type ClockifyTask = { id: string; name: string; isActive: boolean };
export type ClockifyProject = {
  id: string;
  name: string;
  client: string;
  clientId: string | null;
  color: string;
  isActive: boolean;
  managerId: string | null;
  manager: ClockifyManager | null;
  origin: string;
  createdBy?: { id: string; name: string | null; email: string } | null;
  archivedAt?: string | null;
  _count?: { tasks: number };
};
