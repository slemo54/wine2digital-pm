import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { importClockifyProjects, parseClockifyProjectCsv } from "../lib/clockify-v2-import";

async function main() {
  const prisma = new PrismaClient();
  try {
    const filePath = process.argv[2];
    const dryRun = process.argv.includes("--dry-run");
    const expectedArg = process.argv.find((arg) => arg.startsWith("--expected-projects="));
    const expected = Number(expectedArg?.slice("--expected-projects=".length));
    if (!filePath || !Number.isInteger(expected) || expected < 0) {
      // eslint-disable-next-line no-console
      console.error("Usage: tsx scripts/import-clockify-projects.ts /path/to/Clockify_Time_Report.csv --expected-projects=21 [--dry-run]");
      process.exit(1);
    }

    const raw = await readFile(filePath, "utf8");
    const projects = parseClockifyProjectCsv(raw, expected);
    const result = await importClockifyProjects(prisma, projects, dryRun);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        { ok: true, expectedProjects: expected, validatedProjects: projects.length, ...result },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
