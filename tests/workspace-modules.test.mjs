import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("workspace formatting and CSV responsibilities have dedicated modules", async () => {
  const [format, csv] = await Promise.all([
    readFile(new URL("../app/workspace/format.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/workspace/csv-products.ts", import.meta.url), "utf8"),
  ]);

  assert.match(format, /export function money/);
  assert.match(format, /export function configuredUsdRate/);
  assert.match(format, /export function localDateKey/);
  assert.match(format, /export function csvCell/);

  assert.match(csv, /export function parseCsvRows/);
  assert.match(csv, /export function normalizeDigits/);
  assert.match(csv, /export function parseProductsCsv/);
  assert.match(csv, /rows\.length > 50001/);
  assert.match(csv, /seen\.has\(barcode\)/);
  assert.doesNotMatch(csv, /document\.|window\.|localStorage/);
});
