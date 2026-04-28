import test from "node:test";
import assert from "node:assert/strict";
import {
  extractDriveFileId,
  buildDriveViewUrl,
  buildDriveImagePreviewUrl,
  getHrefForFilePath,
  getImageSrcForFilePath
} from "./drive-links.ts";

test("extractDriveFileId: extracts from gdrive prefix", () => {
  assert.strictEqual(extractDriveFileId("gdrive:12345abcde"), "12345abcde");
  assert.strictEqual(extractDriveFileId("gdrive:abc-123_xyz"), "abc-123_xyz");
});

test("extractDriveFileId: extracts from standard drive URL", () => {
  assert.strictEqual(
    extractDriveFileId("https://drive.google.com/file/d/12345abcde/view"),
    "12345abcde"
  );
  assert.strictEqual(
    extractDriveFileId("https://drive.google.com/file/d/abc-123_xyz/view?usp=sharing"),
    "abc-123_xyz"
  );
});

test("extractDriveFileId: extracts from id query parameter", () => {
  assert.strictEqual(
    extractDriveFileId("https://example.com/download?id=12345abcde"),
    "12345abcde"
  );
  assert.strictEqual(
    extractDriveFileId("https://drive.google.com/uc?export=view&id=abc-123_xyz"),
    "abc-123_xyz"
  );
});

test("extractDriveFileId: handles invalid URLs and non-matching strings", () => {
  // Invalid URL string (triggers catch block in new URL(s))
  assert.strictEqual(extractDriveFileId("not a url"), null);
  assert.strictEqual(extractDriveFileId("http://"), null);

  // Valid URL but no id param and no drive pattern
  assert.strictEqual(extractDriveFileId("https://example.com/page"), null);

  // Empty or nullish inputs
  assert.strictEqual(extractDriveFileId(null), null);
  assert.strictEqual(extractDriveFileId(undefined), null);
  assert.strictEqual(extractDriveFileId(""), null);
  assert.strictEqual(extractDriveFileId("   "), null);
});

test("buildDriveViewUrl: builds correct URL", () => {
  assert.strictEqual(
    buildDriveViewUrl("12345"),
    "https://drive.google.com/file/d/12345/view"
  );
});

test("buildDriveImagePreviewUrl: builds correct URL", () => {
  assert.strictEqual(
    buildDriveImagePreviewUrl("12345"),
    "https://drive.google.com/uc?export=view&id=12345"
  );
});

test("getHrefForFilePath: returns drive URL for drive files", () => {
  assert.strictEqual(
    getHrefForFilePath("gdrive:12345"),
    "https://drive.google.com/file/d/12345/view"
  );
  assert.strictEqual(
    getHrefForFilePath("https://drive.google.com/file/d/12345/view"),
    "https://drive.google.com/file/d/12345/view"
  );
});

test("getHrefForFilePath: returns original path for non-drive files", () => {
  assert.strictEqual(getHrefForFilePath("https://example.com/file.pdf"), "https://example.com/file.pdf");
  assert.strictEqual(getHrefForFilePath("some/local/path.jpg"), "some/local/path.jpg");
  assert.strictEqual(getHrefForFilePath(null), null);
});

test("getImageSrcForFilePath: returns drive preview URL for drive files", () => {
  assert.strictEqual(
    getImageSrcForFilePath("gdrive:12345"),
    "https://drive.google.com/uc?export=view&id=12345"
  );
});

test("getImageSrcForFilePath: returns original path for non-drive files", () => {
  assert.strictEqual(getImageSrcForFilePath("https://example.com/img.png"), "https://example.com/img.png");
  assert.strictEqual(getImageSrcForFilePath(null), null);
});
