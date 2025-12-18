import { readFile } from "node:fs/promises";
import crypto from "node:crypto";

type ServiceAccountJson = {
  type: "service_account";
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri: string;
};

type DriveUploadResult = {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
};

export type GoogleDriveFolderMetadata = {
  id: string;
  name: string;
  driveId?: string;
  capabilities?: { canAddChildren: boolean };
};

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwtRs256(payload: object, privateKeyPem: string, keyId: string): string {
  const header = { alg: "RS256", typ: "JWT", kid: keyId };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(privateKeyPem);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function readServiceAccountFromEnv(): Promise<ServiceAccountJson> {
  const jsonInline = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  const jsonBase64 = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64;
  const keyPath = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH;

  let raw: string | null = null;
  if (jsonInline && jsonInline.trim()) {
    raw = jsonInline;
  } else if (jsonBase64 && jsonBase64.trim()) {
    raw = Buffer.from(jsonBase64, "base64").toString("utf8");
  } else if (keyPath && keyPath.trim()) {
    try {
      raw = await readFile(keyPath, "utf8");
    } catch (e: any) {
      const code = String(e?.code || "");
      if (code === "ENOENT" || code === "EACCES") {
        throw new Error(
          `Drive service account key file not readable at GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH. ` +
            `On Vercel, prefer GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 (or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) instead.`
        );
      }
      throw e;
    }
  }

  if (!raw) {
    throw new Error(
      "Missing Drive service account credentials (set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 or GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH)"
    );
  }

  const json = JSON.parse(raw) as ServiceAccountJson;
  if (!json.client_email || !json.private_key || !json.token_uri || !json.private_key_id) {
    throw new Error("Invalid service account JSON");
  }
  return json;
}

export async function getDriveServiceAccountIdentity(): Promise<{
  clientEmail: string;
  projectId: string;
}> {
  const sa = await readServiceAccountFromEnv();
  return { clientEmail: sa.client_email, projectId: sa.project_id };
}

async function getDriveAccessToken(): Promise<string> {
  const sa = await readServiceAccountFromEnv();

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    // drive.file limits access to files created/opened by the app; for a shared target folder we need broader scope
    scope: "https://www.googleapis.com/auth/drive",
    aud: sa.token_uri,
    iat: now,
    exp: now + 60 * 60,
  };

  const assertion = signJwtRs256(payload, sa.private_key, sa.private_key_id);
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Drive token error: ${data.error || "unknown"} ${data.error_description || ""}`.trim());
  }
  return data.access_token;
}

export async function verifyDriveServiceAccountAccess(args: {
  folderId: string;
}): Promise<{ ok: true; metadata: GoogleDriveFolderMetadata } | { ok: false; error: string; isSharedDrive?: boolean }> {
  try {
    const token = await getDriveAccessToken();
    const url =
      "https://www.googleapis.com/drive/v3/files/" +
      encodeURIComponent(args.folderId) +
      "?supportsAllDrives=true&fields=id,name,driveId,capabilities";

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-cache",
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text };
    }
    const data = (await res.json()) as GoogleDriveFolderMetadata;
    const isSharedDrive = !!data.driveId; // If driveId exists, it's in a Shared Drive
    return { ok: true, metadata: data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function uploadFileToDrive(args: {
  folderId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<DriveUploadResult> {
  const token = await getDriveAccessToken();
  const boundary = `----w2dpm-${crypto.randomBytes(12).toString("hex")}`;

  const metadata = {
    name: args.fileName,
    parents: [args.folderId],
  };

  const preamble =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${args.mimeType || "application/octet-stream"}\r\n\r\n`;

  const epilogue = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(preamble, "utf8"),
    Buffer.from(args.bytes),
    Buffer.from(epilogue, "utf8"),
  ]);

  const url =
    "https://www.googleapis.com/upload/drive/v3/files" +
    "?uploadType=multipart" +
    "&supportsAllDrives=true" +
    "&fields=id,name,mimeType,size,webViewLink,webContentLink";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });

  const data = (await res.json()) as DriveUploadResult & { error?: any };
  if (!res.ok || !data.id) {
    let msg = data?.error?.message ? String(data.error.message) : "Drive upload failed";
    
    // Specific error handling for storage quota issues
    if (msg.includes("storage quota") || msg.includes("Service Accounts do not have storage quota")) {
      msg = "Service Accounts cannot use personal Drive storage quota. Please use a Shared Drive (Drive condiviso) instead. " +
            "Create a Shared Drive in Google Workspace, add the service account as a member, and update GOOGLE_DRIVE_FOLDER_ID to point to a folder inside that Shared Drive.";
    }
    
    throw new Error(msg);
  }
  return data;
}

export async function deleteDriveFile(args: { fileId: string }): Promise<void> {
  const token = await getDriveAccessToken();
  const url =
    "https://www.googleapis.com/drive/v3/files/" +
    encodeURIComponent(args.fileId) +
    "?supportsAllDrives=true";

  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Drive delete failed");
  }
}
