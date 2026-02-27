"use client";

// xlsx is dynamically imported only when needed to reduce bundle size

export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export function buildDelimitedText(opts: {
  header: string[];
  rows: unknown[][];
  delimiter?: string;
  includeBom?: boolean;
}): string {
  const delimiter = opts.delimiter ?? ";";
  const includeBom = opts.includeBom ?? true;
  const header = Array.isArray(opts.header) ? opts.header : [];
  const rows = Array.isArray(opts.rows) ? opts.rows : [];

  const lines: string[] = [];
  lines.push(header.map(escapeCsvCell).join(delimiter));
  for (const r of rows) {
    const cells = Array.isArray(r) ? r : [];
    lines.push(cells.map(escapeCsvCell).join(delimiter));
  }
  const body = lines.join("\n");
  return includeBom ? `\uFEFF${body}` : body;
}

function escapeHtml(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildXlsHtml(opts: { header: string[]; rows: unknown[][]; sheetName?: string }): string {
  const header = Array.isArray(opts.header) ? opts.header : [];
  const rows = Array.isArray(opts.rows) ? opts.rows : [];
  const sheetName = String(opts.sheetName || "Sheet1");

  const thead =
    "<tr>" + header.map((h) => `<th>${escapeHtml(h)}</th>`).join("") + "</tr>";
  const tbody =
    rows
      .map((r) => {
        const cells = Array.isArray(r) ? r : [];
        return "<tr>" + cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("") + "</tr>";
      })
      .join("") || "";

  return [
    "<html>",
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(sheetName)}</title>`,
    "</head>",
    "<body>",
    '<table border="1">',
    "<thead>",
    thead,
    "</thead>",
    "<tbody>",
    tbody,
    "</tbody>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsvFile(filename: string, csv: string): void {
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

export function downloadXlsFile(filename: string, html: string): void {
  downloadBlob(filename, new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }));
}

export function safeFileStem(input: string): string {
  const s = String(input || "").trim() || "export";
  return s
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isoDate(date: unknown): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(String(date));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function centsToEuros(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null;
  if (!Number.isFinite(cents)) return null;
  return cents / 100;
}

export async function buildXlsxAccounting(opts: {
  header: string[];
  rows: unknown[][];
  sheetName?: string;
}): Promise<ArrayBuffer> {
  // Dynamic import to reduce initial bundle size
  const XLSX = await import("xlsx");
  
  const header = opts.header;
  const rows = opts.rows;
  const sheetName = opts.sheetName || "Tasks";

  // Crea worksheet con header e data
  const data = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Applica formattazione numerica alla colonna F (amountEur)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let row = 1; row <= range.e.r; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 5 }); // colonna F (index 5)
    if (ws[cellAddress] && typeof ws[cellAddress].v === "number") {
      ws[cellAddress].t = "n";
      ws[cellAddress].z = "#,##0.00";
    }
  }

  // Crea workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Write to ArrayBuffer
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function downloadXlsxFile(filename: string, buffer: ArrayBuffer): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(filename, blob);
}

