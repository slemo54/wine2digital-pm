import { buildSimpleEmail } from "@/lib/email/templates";

function getBaseUrl(): string {
  const raw = String(process.env.NEXTAUTH_URL || "").trim();
  return raw || "http://localhost:3000";
}

export function buildAbsoluteUrl(pathOrUrl: string): string {
  const s = String(pathOrUrl || "").trim();
  if (!s) return getBaseUrl();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = getBaseUrl().replace(/\/+$/, "");
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${base}${path}`;
}

export function buildMentionEmail(opts: {
  authorLabel: string;
  taskTitle: string;
  subtaskTitle: string;
  link: string;
}): { subject: string; html: string; text: string } {
  const { html, text } = buildSimpleEmail({
    title: "Sei stato menzionato",
    lines: [
      `${opts.authorLabel} ti ha menzionato in: ${opts.subtaskTitle}`,
      `Task: ${opts.taskTitle}`,
    ],
    ctaLabel: "Apri",
    ctaUrl: buildAbsoluteUrl(opts.link),
  });
  return { subject: `Menzione: ${opts.subtaskTitle}`, html, text };
}

export function buildChatEmail(opts: {
  projectName: string;
  authorLabel: string;
  messagePreview?: string;
  link: string;
}): { subject: string; html: string; text: string } {
  const preview = String(opts.messagePreview || "").trim();
  const lines = [`Nuovo messaggio in ${opts.projectName}`, `Da: ${opts.authorLabel}`];
  if (preview) lines.push(`Messaggio: ${preview}`);
  const { html, text } = buildSimpleEmail({
    title: "Nuovo messaggio",
    lines,
    ctaLabel: "Apri progetto",
    ctaUrl: buildAbsoluteUrl(opts.link),
  });
  return { subject: `Nuovo messaggio: ${opts.projectName}`, html, text };
}

export function buildAbsenceDecisionEmail(opts: {
  status: "approved" | "rejected";
  startDateLabel: string;
  endDateLabel: string;
  link: string;
}): { subject: string; html: string; text: string } {
  const statusLabel = opts.status === "approved" ? "Approvata" : "Rifiutata";
  const { html, text } = buildSimpleEmail({
    title: `Richiesta assenza ${statusLabel}`,
    lines: [`Periodo: ${opts.startDateLabel} → ${opts.endDateLabel}`],
    ctaLabel: "Apri calendario",
    ctaUrl: buildAbsoluteUrl(opts.link),
  });
  return { subject: `Richiesta assenza ${statusLabel}`, html, text };
}

