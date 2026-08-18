import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home and module routes are gated by resilient storage bootstrap", async () => {
  const [pageSource, routeSource, rootSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/module/[moduleKey]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resilient-pos-root.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /import ResilientPosRoot from "\.\/resilient-pos-root"/);
  assert.match(routeSource, /import ResilientPosRoot from "\.\.\/\.\.\/resilient-pos-root"/);
  assert.match(pageSource, /initialModuleKey/);
  assert.match(routeSource, /initialModuleKey=\{moduleKey\}/);
  assert.match(rootSource, /verifyStorageEndToEnd/);
});

test("bootstrap proves the exact full dashboard read before mounting POS", async () => {
  const rootSource = await readFile(new URL("../app/resilient-pos-root.tsx", import.meta.url), "utf8");
  assert.match(rootSource, /db\.openPosDatabase\(\)/);
  assert.match(rootSource, /db\.ensureJournalOpeningSnapshot\(\)/);
  assert.match(rootSource, /db\.loadDashboardData\(\)/);
  assert.match(rootSource, /POS_DB_CHUNK_TIMEOUT/);
  assert.match(rootSource, /POS_DB_OPEN_TIMEOUT/);
  assert.match(rootSource, /POS_DB_INIT_TIMEOUT/);
  assert.match(rootSource, /POS_DASHBOARD_READ_TIMEOUT/);
  assert.match(rootSource, /POS_BOOT_WATCHDOG_TIMEOUT/);
  assert.match(rootSource, /دووبارە هەوڵدانەوە/);
});

test("embedded preview installs memory IndexedDB before database import", async () => {
  const rootSource = await readFile(new URL("../app/resilient-pos-root.tsx", import.meta.url), "utf8");
  assert.match(rootSource, /indexedDB as memoryIndexedDB/);
  assert.match(rootSource, /IDBKeyRange as MemoryIDBKeyRange/);
  assert.match(rootSource, /isEmbeddedPreview\(\) && !installMemoryStorage\(\)/);
  assert.match(rootSource, /aistudio\.google\.com/);
  assert.match(rootSource, /googleusercontent\.com/);
  assert.doesNotMatch(rootSource, /fake-indexeddb\/auto/);
});

test("heavy POS and workspace code are split away from first boot", async () => {
  const [rootSource, launcherSource] = await Promise.all([
    readFile(new URL("../app/resilient-pos-root.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(rootSource, /import\("\.\/pos-app-v3"\)/);
  assert.match(launcherSource, /import dynamic from "next\/dynamic"/);
  assert.match(launcherSource, /dynamic\(\(\) => import\("\.\/module-workspace"\)/);
  assert.match(launcherSource, /ssr:\s*false/);
  assert.match(launcherSource, /import\("@\/lib\/pos-db"\)/);
});

test("launcher remains PIN-free and native module routes work without JS clicks", async () => {
  const launcherSource = await readFile(new URL("../app/pos-app-v3.tsx", import.meta.url), "utf8");
  assert.match(launcherSource, /data-launcher-version="v4"/);
  assert.match(launcherSource, /href=\{`\/module\/\$\{module\.key\}`\}/);
  assert.match(launcherSource, /activeRole="owner"/);
  assert.doesNotMatch(launcherSource, /PinSetup|PinLock|SecurityPanel|verifyDevicePin|isValidPin/);
});
