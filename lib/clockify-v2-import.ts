import { parse } from "csv-parse/sync";
import { normalizeClockifyName } from "./clockify-v2-catalog";
import { runClockifySerializableTransaction } from "./clockify-v2-entries";

type Db = any;
export type ClockifyImportProject = { name: string; client: string; normalizedClient: string };

export class ClockifyImportError extends Error {}

function cell(value: unknown): string { return String(value ?? "").normalize("NFKC").trim(); }

/** This pure parser must run before a Prisma client is touched. */
export function parseClockifyProjectCsv(csv: string, expectedProjects: number): ClockifyImportProject[] {
  if (!Number.isInteger(expectedProjects) || expectedProjects < 0) throw new ClockifyImportError("expected projects must be a non-negative integer");
  let records: Record<string, unknown>[];
  const source = csv.replace(/^\uFEFF/, "");
  try { records = parse(source, { columns: true, skip_empty_lines: true, relax_column_count: false, trim: false }); }
  catch { throw new ClockifyImportError("CSV columns are invalid"); }
  const first = source.split(/\r?\n/, 1)[0]?.split(",").map((header) => header.trim()) || [];
  if (first.length !== 2 || first[0] !== "Project" || first[1] !== "Client") throw new ClockifyImportError("CSV header must be exactly Project,Client");
  const unique = new Map<string, ClockifyImportProject>();
  for (const record of records) {
    const name = cell(record.Project); const client = cell(record.Client);
    if (!name) throw new ClockifyImportError("Every CSV row requires a Project value");
    const normalizedClient = normalizeClockifyName(client || "Senza cliente");
    const project = { name, client, normalizedClient };
    unique.set(`${name}\u0000${client}`, project);
  }
  const projects = [...unique.values()];
  if (projects.length !== expectedProjects) throw new ClockifyImportError(`CSV has ${projects.length} unique projects; expected ${expectedProjects}`);
  return projects;
}

export async function importClockifyProjects(db: Db, projects: ClockifyImportProject[], dryRun: boolean): Promise<{ clients: number; projects: number; dryRun: boolean }> {
  if (dryRun) return { clients: new Set(projects.map((project) => project.normalizedClient)).size, projects: projects.length, dryRun: true };
  return runClockifySerializableTransaction(db, async (tx) => {
    let clients = 0; let createdProjects = 0;
    const clientIds = new Map<string, string>();
    for (const project of projects) {
      let clientId = clientIds.get(project.normalizedClient);
      if (!clientId) {
        const existing = await tx.clockifyClient.findUnique({ where: { normalizedName: project.normalizedClient }, select: { id: true } });
        const client = existing || await tx.clockifyClient.create({ data: { name: project.client || "Senza cliente", normalizedName: project.normalizedClient }, select: { id: true } });
        if (!existing) clients += 1;
        clientId = String(client.id); clientIds.set(project.normalizedClient, clientId);
      }
      const existingProject = await tx.clockifyProject.findUnique({ where: { name_client: { name: project.name, client: project.client } }, select: { id: true } });
      if (!existingProject) {
        await tx.clockifyProject.create({ data: { name: project.name, client: project.client, clientId, origin: "imported", createdById: null, managerId: null } });
        createdProjects += 1;
      }
    }
    return { clients, projects: createdProjects, dryRun: false };
  });
}
