import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home and direct module routes use the resilient PIN-free launcher", async () => {
  const [pageSource, modulePageSource, launcherSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/module/[moduleKey]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /import PosAppV3 from "\.\/pos-app-v3"/);
  assert.match(modulePageSource, /import PosAppV3 from "\.\.\/\.\.\/pos-app-v3"/);
  assert.match(pageSource, /initialModuleKey/);
  assert.match(launcherSource, /href=\{`\/module\/\$\{module\.key\}`\}/);
  assert.match(launcherSource, /activeRole="owner"/);
  assert.doesNotMatch(launcherSource, /PinSetup|PinLock|SecurityPanel|verifyDevicePin|isValidPin/);
});

test("storage boot never mounts a module before IndexedDB is known to be usable", async () => {
  const launcherSource = await readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8");
  assert.match(launcherSource, /probeNativeIndexedDb/);
  assert.match(launcherSource, /timeoutMs = 1500/);
  assert.match(launcherSource, /import\("fake-indexeddb\/auto"\)/);
  assert.match(launcherSource, /withTimeout\(openPosDatabase\(\), 4000/);
  assert.match(launcherSource, /withTimeout\(ensureJournalOpeningSnapshot\(\), 4000/);
  assert.match(launcherSource, /withTimeout\(refreshCounts\(\), 4000/);
  assert.match(launcherSource, /const storageReady = storageStatus === "ready" \|\| storageStatus === "memory"/);
  assert.match(launcherSource, /!storageReady \? <div className="workspace-loading"/);
});

test("embedded preview fallback is explicit instead of an infinite local-data spinner", async () => {
  const [launcherSource, packageSource] = await Promise.all([
    readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(packageSource, /"fake-indexeddb"/);
  assert.match(launcherSource, /storageStatus === "memory"/);
  assert.match(launcherSource, /AI Studio Preview: storage fallback چالاکە/);
  assert.match(launcherSource, /storageStatus === "error"/);
});
