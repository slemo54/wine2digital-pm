export function extractDriveFileId(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const s = String(filePath).trim();
  if (!s) return null;

  const gdrivePrefix = /^gdrive:([a-zA-Z0-9_-]+)$/;
  const m1 = s.match(gdrivePrefix);
  if (m1?.[1]) return m1[1];

  // https://drive.google.com/file/d/<id>/view
  const m2 = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m2?.[1]) return m2[1];

  try {
    const url = new URL(s);
    const id = url.searchParams.get("id");
    if (id) return id;
  } catch {
    // not a URL
  }

  return null;
}

export function buildDriveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

export function buildDriveImagePreviewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

export function getHrefForFilePath(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const driveFileId = extractDriveFileId(filePath);
  if (driveFileId) return buildDriveViewUrl(driveFileId);
  const s = String(filePath).trim();
  return s || null;
}

export function getImageSrcForFilePath(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const driveFileId = extractDriveFileId(filePath);
  if (driveFileId) return buildDriveImagePreviewUrl(driveFileId);
  const s = String(filePath).trim();
  return s || null;
}

