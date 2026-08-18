import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home uses the deterministic PIN-free POS launcher with a server module fallback", async () => {
  const [pageSource, launcherSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pos-app-v2.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /import PosAppV2 from "\.\/pos-app-v2"/);
  assert.match(pageSource, /searchParams/);
  assert.match(pageSource, /initialModuleKey/);
  assert.doesNotMatch(pageSource, /\.\/pos-app"/);

  assert.match(launcherSource, /data-navigation-version="native-v3"/);
  assert.match(launcherSource, /const openModule = useCallback\(\(key: ModuleKey\) =>/);
  assert.match(launcherSource, /setActiveModule\(selected\)/);
  assert.match(launcherSource, /data-module-key=\{module\.key\}/);
  assert.match(launcherSource, /href=\{`\/\?module=\$\{encodeURIComponent\(module\.key\)\}`\}/);
  assert.match(launcherSource, /onClick=\{\(event\) => openModuleFromLink\(event, module\.key\)\}/);
  assert.match(launcherSource, /activeRole="owner"/);

  assert.doesNotMatch(launcherSource, /PinSetup|PinLock|SecurityPanel|verifyDevicePin|isValidPin/);
  assert.doesNotMatch(launcherSource, /localStorage|getItem\(MODULE_USAGE_KEY/);
});

test("native module links still navigate when React hydration is unavailable", async () => {
  const [launcherSource, fallbackCss] = await Promise.all([
    readFile(new URL("../app/pos-app-v2.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/navigation-fallback.css", import.meta.url), "utf8"),
  ]);
  assert.match(launcherSource, /<a\s+[\s\S]*?href=\{`\/\?module=/);
  assert.match(launcherSource, /moduleForKey\(initialModuleKey\)/);
  assert.match(launcherSource, /window\.history\.replaceState/);
  assert.match(fallbackCss, /\.module-card\[href\]/);
  assert.match(fallbackCss, /pointer-events:\s*auto/);
});

test("launcher clears legacy shell caches and service workers that can break hydration", async () => {
  const launcherSource = await readFile(new URL("../app/pos-app-v2.tsx", import.meta.url), "utf8");
  assert.match(launcherSource, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(launcherSource, /registration\.unregister\(\)/);
  assert.match(launcherSource, /key\.startsWith\("zhirox-pos-shell-"\)/);
  assert.doesNotMatch(launcherSource, /serviceWorker\.register\(/);
});
