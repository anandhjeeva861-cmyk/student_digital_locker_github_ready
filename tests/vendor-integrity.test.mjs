import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const vendorBundle = new URL("../js/vendor/exceljs/exceljs.min.js", import.meta.url);
const expectedSha256 = "7E49DA68588E250DBB8BBA190D2CAA8AB3787CC0284BDA1D8B2F805C4DF742C9";
const expectedBytes = 947702;
const expectedMarker = "/*! ExcelJS 19-10-2023 */";

test("vendored ExcelJS bundle is the pinned release", async () => {
  const buffer = await readFile(vendorBundle);
  assert.equal(buffer.length, expectedBytes, "bundle size changed; re-pin only from the official ExcelJS source");
  const actualSha256 = createHash("sha256").update(buffer).digest("hex").toUpperCase();
  assert.equal(actualSha256, expectedSha256, "bundle content changed; re-pin only from the official ExcelJS source");
});

test("vendored ExcelJS bundle carries the expected provenance marker", async () => {
  const buffer = await readFile(vendorBundle);
  assert.equal(buffer.subarray(0, expectedMarker.length).toString(), expectedMarker);
});