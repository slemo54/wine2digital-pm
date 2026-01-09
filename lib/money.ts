export function formatEurCents(cents: number): string {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "€ 0,00";
  const euros = value / 100;
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(euros);
}

function normalizeNumberString(input: string): string {
  // Remove currency symbols and spaces; keep digits, separators, minus (we'll reject negatives later)
  return input
    .replace(/\s+/g, "")
    .replace(/€/g, "")
    .replace(/'/g, "")
    .trim();
}

function isThousandsSeparatedSingle(sep: "." | ",", s: string): boolean {
  const idx = s.lastIndexOf(sep);
  if (idx < 0) return false;
  const after = s.slice(idx + 1);
  // If exactly 3 digits after separator, it's very likely thousands separator (e.g., 1.234 / 1,234)
  return /^\d{3}$/.test(after);
}

export function parseEurToCents(input: string): number | null {
  const raw = normalizeNumberString(String(input || ""));
  if (!raw) return null;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  let normalized = raw;

  if (hasComma && hasDot) {
    // Assume Italian format: thousands '.' and decimal ','
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    if (isThousandsSeparatedSingle(",", normalized)) {
      // e.g. 1,234 -> 1234
      normalized = normalized.replace(/,/g, "");
    } else {
      // Decimal ','; if multiple commas, keep last as decimal separator
      const parts = normalized.split(",");
      const last = parts.pop() || "";
      normalized = `${parts.join("")}.${last}`;
    }
  } else if (hasDot) {
    if (isThousandsSeparatedSingle(".", normalized)) {
      // e.g. 1.234 -> 1234
      normalized = normalized.replace(/\./g, "");
    } else {
      // Decimal '.'; if multiple dots, keep last as decimal separator
      const parts = normalized.split(".");
      const last = parts.pop() || "";
      normalized = `${parts.join("")}.${last}`;
    }
  }

  // Now normalized should be like 1234 or 1234.56
  if (!/^-?\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  if (value < 0) return null;
  return Math.round(value * 100);
}

