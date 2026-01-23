import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

function normalizeCell(input: unknown): string {
  return String(input ?? "").trim();
}

type ClockifyCsvRow = {
  Project?: unknown;
  Client?: unknown;
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const filePath = process.argv[2];
    if (!filePath) {
      // eslint-disable-next-line no-console
      console.error("Usage: tsx scripts/import-clockify-projects.ts /path/to/Clockify_Time_Report.csv");
      process.exit(1);
    }

    const raw = await readFile(filePath, "utf8");
    const records = parse(raw, { columns: true, skip_empty_lines: true }) as ClockifyCsvRow[];

    const unique = new Map<string, { name: string; client: string }>();
    for (const r of records) {
      const name = normalizeCell(r.Project);
      const client = normalizeCell(r.Client);
      if (!name) continue;
      const key = `${name}||${client}`;
      if (!unique.has(key)) unique.set(key, { name, client });
    }

    let processed = 0;
    for (const p of unique.values()) {
      await prisma.clockifyProject.upsert({
        where: { name_client: { name: p.name, client: p.client } },
        create: { name: p.name, client: p.client, isActive: true },
        update: { isActive: true },
      });
      processed += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        { ok: true, inputRows: records.length, uniqueProjects: unique.size, processed },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

