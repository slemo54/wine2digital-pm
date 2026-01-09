function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildSimpleEmail(opts: {
  title: string;
  lines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}): { html: string; text: string } {
  const title = String(opts.title || "").trim();
  const lines = Array.isArray(opts.lines) ? opts.lines.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const ctaLabel = opts.ctaLabel ? String(opts.ctaLabel).trim() : "";
  const ctaUrl = opts.ctaUrl ? String(opts.ctaUrl).trim() : "";

  const textParts = [title, "", ...lines];
  if (ctaLabel && ctaUrl) textParts.push("", `${ctaLabel}: ${ctaUrl}`);
  const text = textParts.join("\n").trim();

  const htmlLines = lines.map((l) => `<p style="margin:0 0 8px 0;">${escapeHtml(l)}</p>`).join("");
  const cta =
    ctaLabel && ctaUrl
      ? `<p style="margin:16px 0 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#111827;color:#fff;text-decoration:none;">${escapeHtml(ctaLabel)}</a></p>`
      : "";

  const html = `<!doctype html>
<html>
  <body style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:#f6f7fb; margin:0; padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
      <h1 style="font-size:18px;margin:0 0 12px 0;color:#111827;">${escapeHtml(title)}</h1>
      ${htmlLines}
      ${cta}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="margin:0;color:#6b7280;font-size:12px;">Wine2Digital PM</p>
    </div>
  </body>
</html>`;

  return { html, text };
}

