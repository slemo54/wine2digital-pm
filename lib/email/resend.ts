type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

export function isEmailNotificationsEnabled(): boolean {
  return String(process.env.EMAIL_NOTIFICATIONS_ENABLED || "").toLowerCase() === "true";
}

export function getResendFrom(): string {
  return String(process.env.RESEND_FROM || "it@mammajumboshrimp.com").trim();
}

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }
  | { ok: true; skipped: true; reason: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailNotificationsEnabled()) {
    return { ok: true, skipped: true, reason: "EMAIL_NOTIFICATIONS_ENABLED is false" };
  }

  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }

  const from = getResendFrom();
  const to = Array.isArray(input.to) ? input.to : [input.to];
  const subject = String(input.subject || "").trim();
  const html = input.html ? String(input.html) : undefined;
  const text = input.text ? String(input.text) : undefined;
  if (!subject) return { ok: false, error: "Missing subject" };
  if (!to.length || to.some((x) => !String(x || "").trim())) return { ok: false, error: "Missing to" };
  if (!html && !text) return { ok: false, error: "Missing html/text" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const message = String(data?.message || data?.error || `Resend error (${res.status})`);
      return { ok: false, error: message };
    }
    return { ok: true, id: data?.id ? String(data.id) : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

