import crypto from "node:crypto";

type PublishInput = {
  channel: string;
  event: string;
  data: any;
};

function jsonStable(data: any): string {
  try {
    return JSON.stringify(data);
  } catch {
    return JSON.stringify({ _error: "unserializable" });
  }
}

async function publishAbly(input: PublishInput): Promise<void> {
  const key = process.env.ABLY_API_KEY;
  if (!key) throw new Error("Missing ABLY_API_KEY");
  const url = `https://rest.ably.io/channels/${encodeURIComponent(input.channel)}/messages`;
  const body = [{ name: input.event, data: input.data }];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(key).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ably publish failed: ${text}`);
  }
}

async function publishPusher(input: PublishInput): Promise<void> {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!appId || !key || !secret || !cluster) throw new Error("Missing PUSHER_* env vars");

  const path = `/apps/${appId}/events`;
  const body = {
    name: input.event,
    channels: [input.channel],
    data: jsonStable(input.data),
  };
  const bodyStr = JSON.stringify(body);
  const bodyMd5 = crypto.createHash("md5").update(bodyStr).digest("hex");

  const params = new URLSearchParams({
    auth_key: key,
    auth_timestamp: String(Math.floor(Date.now() / 1000)),
    auth_version: "1.0",
    body_md5: bodyMd5,
  });

  const stringToSign = `POST\n${path}\n${params.toString()}`;
  const signature = crypto.createHmac("sha256", secret).update(stringToSign).digest("hex");
  params.set("auth_signature", signature);

  const url = `https://api-${cluster}.pusher.com${path}?${params.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyStr,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pusher publish failed: ${text}`);
  }
}

export async function publishRealtimeEvent(input: PublishInput): Promise<void> {
  const provider = (process.env.REALTIME_PROVIDER || "").trim().toLowerCase();

  // No-op if not configured
  if (!provider) return;

  if (provider === "ably") return publishAbly(input);
  if (provider === "pusher") return publishPusher(input);
  throw new Error(`Unknown REALTIME_PROVIDER: ${provider}`);
}


