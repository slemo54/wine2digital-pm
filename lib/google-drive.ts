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

const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DEFAULT_DRIVE_TIMEZONE = "Europe/Rome";

export function sanitizeDriveFolderName(input: string): string {
  const trimmed = String(input || "").trim();
  if (!trimmed) return "Untitled";

  // Keep names human-friendly while avoiding path-like / unsafe characters
  const cleaned = trimmed
    .replace(/[\/\\]/g, "-")
    .replace(/[:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  // Drive allows long names, but keep it reasonable
  return cleaned.length > 80 ? cleaned.slice(0, 80).trim() : cleaned;
}

export function getDriveYearMonth(date: Date, timeZone?: string): string {
  const tz = timeZone || DEFAULT_DRIVE_TIMEZONE;
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    if (year && month) return `${year}-${month}`;
  } catch {
    // fall back to UTC below
  }
  return date.toISOString().slice(0, 7);
}

export function buildDriveUploadFolderNames(args: {
  date: Date;
  timeZone?: string;
  projectName?: string | null | undefined;
  projectId?: string | null | undefined;
}): { monthFolderName: string; projectFolderName: string | null } {
  const monthFolderName = getDriveYearMonth(args.date, args.timeZone);
  const baseProject = args.projectName?.trim() ? sanitizeDriveFolderName(args.projectName) : null;
  const projectId = args.projectId?.trim() ? String(args.projectId) : null;

  if (!baseProject && !projectId) return { monthFolderName, projectFolderName: null };

  // Keep name readable, but reduce collisions by suffixing a short id when available
  const suffix = projectId ? ` - ${projectId.slice(0, 6)}` : "";
  const projectFolderName = sanitizeDriveFolderName((baseProject || `project-${projectId}`) + suffix);
  return { monthFolderName, projectFolderName };
}

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

export async function getDriveAccessToken(): Promise<string> {
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

function escapeDriveQueryString(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function driveFindFolderByName(args: {
  token: string;
  parentId: string;
  name: string;
}): Promise<GoogleDriveFolderMetadata | null> {
  const q = [
    `name='${escapeDriveQueryString(args.name)}'`,
    `mimeType='${DRIVE_FOLDER_MIME_TYPE}'`,
    `'${escapeDriveQueryString(args.parentId)}' in parents`,
    "trashed=false",
  ].join(" and ");

  const url =
    "https://www.googleapis.com/drive/v3/files" +
    `?q=${encodeURIComponent(q)}` +
    "&supportsAllDrives=true" +
    "&includeItemsFromAllDrives=true" +
    "&pageSize=1" +
    "&fields=files(id,name,driveId,capabilities)";

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${args.token}` },
    cache: "no-cache",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Drive folder lookup failed");
  }
  const data = (await res.json()) as { files?: GoogleDriveFolderMetadata[] };
  const files = Array.isArray(data.files) ? data.files : [];
  return files[0] || null;
}

async function driveCreateFolder(args: {
  token: string;
  parentId: string;
  name: string;
}): Promise<GoogleDriveFolderMetadata> {
  const url =
    "https://www.googleapis.com/drive/v3/files" +
    "?supportsAllDrives=true" +
    "&fields=id,name,driveId,capabilities";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: args.name,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      parents: [args.parentId],
    }),
  });

  const data = (await res.json()) as GoogleDriveFolderMetadata & { error?: any };
  if (!res.ok || !data?.id) {
    const msg = data?.error?.message ? String(data.error.message) : await res.text();
    throw new Error(msg || "Drive folder create failed");
  }
  return data;
}

async function ensureDriveFolder(args: {
  token: string;
  parentId: string;
  name: string;
}): Promise<GoogleDriveFolderMetadata> {
  const existing = await driveFindFolderByName(args).catch(() => null);
  if (existing) return existing;
  return await driveCreateFolder(args);
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

export async function resolveDriveUploadFolderId(args: {
  baseFolderId: string;
  projectName?: string | null;
  projectId?: string | null;
  now?: Date;
  timeZone?: string;
}): Promise<string> {
  const token = await getDriveAccessToken();
  const { monthFolderName, projectFolderName } = buildDriveUploadFolderNames({
    date: args.now ?? new Date(),
    timeZone: args.timeZone || process.env.GOOGLE_DRIVE_FOLDER_TIMEZONE || DEFAULT_DRIVE_TIMEZONE,
    projectName: args.projectName,
    projectId: args.projectId,
  });

  const monthFolder = await ensureDriveFolder({
    token,
    parentId: args.baseFolderId,
    name: monthFolderName,
  });

  if (!projectFolderName) return monthFolder.id;

  const projectFolder = await ensureDriveFolder({
    token,
    parentId: monthFolder.id,
    name: projectFolderName,
  });
  return projectFolder.id;
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
