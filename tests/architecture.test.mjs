import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("fresh architecture has exactly 21 native-routed modules", async () => {
  const source = await readFile(new URL("../lib/modules.ts", import.meta.url), "utf8");
  const matches = [...source.matchAll(/\{ key: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(matches.length, 21);
  assert.equal(new Set(matches).size, 21);
});

test("dashboard navigation does not depend on client hydration", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /"use client"|onClick|useEffect|useState|indexedDB|serviceWorker|Pin/);
  assert.match(source, /href=\{`\/module\/\$\{module\.key\}`\}/);
});

test("legacy failure sources are absent from fresh runtime", async () => {
  const [page, route, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/module/[moduleKey]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const runtime = `${page}\n${route}\n${packageJson}`;
  for (const forbidden of ["fake-indexeddb", "serviceWorker", "PBKDF2", "PinLock", "PinSetup", "indexedDB", "wrangler", "drizzle-orm"]) {
    assert.doesNotMatch(runtime, new RegExp(forbidden, "i"));
  }
});
