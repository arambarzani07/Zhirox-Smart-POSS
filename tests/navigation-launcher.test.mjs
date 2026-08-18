import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home uses the PIN-free V3 launcher with server module fallback", async () => {
  const [pageSource, launcherSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /import PosAppV3 from "\.\/pos-app-v3"/);
  assert.match(pageSource, /searchParams/);
  assert.match(pageSource, /initialModuleKey/);
  assert.match(launcherSource, /data-launcher-version="v4"/);
  assert.match(launcherSource, /href=\{`\/module\/\$\{module\.key\}`\}/);
  assert.match(launcherSource, /activeRole="owner"/);
  assert.doesNotMatch(launcherSource, /PinSetup|PinLock|SecurityPanel|verifyDevicePin|isValidPin/);
});

test("embedded preview installs IndexedDB fallback synchronously before storage boot", async () => {
  const launcherSource = await readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8");
  assert.match(launcherSource, /indexedDB as memoryIndexedDB/);
  assert.match(launcherSource, /IDBKeyRange as MemoryIDBKeyRange/);
  assert.match(launcherSource, /if \(typeof window !== "undefined" && isEmbeddedPreview\(\)\) installMemoryIndexedDb\(\)/);
  assert.doesNotMatch(launcherSource, /import\("fake-indexeddb\/auto"\)/);
  assert.match(launcherSource, /location\.hostname\.includes\("googleusercontent\.com"\)/);
});

test("storage boot cannot remain on an infinite spinner", async () => {
  const launcherSource = await readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8");
  assert.match(launcherSource, /LOCAL_DB_OPEN_TIMEOUT/);
  assert.match(launcherSource, /LOCAL_DB_INIT_TIMEOUT/);
  assert.match(launcherSource, /LOCAL_DB_READ_TIMEOUT/);
  assert.match(launcherSource, /STORAGE_BOOT_WATCHDOG_TIMEOUT/);
  assert.match(launcherSource, /setBootAttempt/);
  assert.match(launcherSource, /دووبارە هەوڵدانەوە/);
});

test("heavy module workspace is split out of the initial launcher bundle", async () => {
  const launcherSource = await readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8");
  assert.match(launcherSource, /import dynamic from "next\/dynamic"/);
  assert.match(launcherSource, /dynamic\(\(\) => import\("\.\/module-workspace"\)/);
  assert.match(launcherSource, /ssr:\s*false/);
  assert.doesNotMatch(launcherSource, /import ModuleWorkspace, \{/);
});

test("native module routes still work without React click handlers", async () => {
  const [launcherSource, routeSource] = await Promise.all([
    readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/module/[moduleKey]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(launcherSource, /href=\{`\/module\/\$\{module\.key\}`\}/);
  assert.match(routeSource, /initialModuleKey=\{moduleKey\}/);
});
