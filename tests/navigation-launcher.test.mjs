import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home uses the deterministic PIN-free POS launcher", async () => {
  const [pageSource, launcherSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pos-app-v2.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /import PosAppV2 from "\.\/pos-app-v2"/);
  assert.match(pageSource, /<PosAppV2\s*\/>/);
  assert.doesNotMatch(pageSource, /\.\/pos-app"/);

  assert.match(launcherSource, /const openModule = useCallback\(\(key: ModuleKey\) =>/);
  assert.match(launcherSource, /setActiveModule\(selected\)/);
  assert.match(launcherSource, /data-module-key=\{module\.key\}/);
  assert.match(launcherSource, /onClick=\{\(\) => openModule\(module\.key\)\}/);
  assert.match(launcherSource, /activeRole="owner"/);

  assert.doesNotMatch(launcherSource, /PinSetup|PinLock|SecurityPanel|verifyDevicePin|isValidPin/);
  assert.doesNotMatch(launcherSource, /localStorage|getItem\(MODULE_USAGE_KEY/);
});

test("launcher clears legacy shell caches and service workers that can break hydration", async () => {
  const launcherSource = await readFile(new URL("../app/pos-app-v2.tsx", import.meta.url), "utf8");
  assert.match(launcherSource, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(launcherSource, /registration\.unregister\(\)/);
  assert.match(launcherSource, /key\.startsWith\("zhirox-pos-shell-"\)/);
  assert.doesNotMatch(launcherSource, /serviceWorker\.register\(/);
});
