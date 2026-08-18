import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard modules remain navigable before optional PIN setup", async () => {
  const app = await readFile(new URL("../app/pos-app.tsx", import.meta.url), "utf8");

  assert.match(app, /if \(!security\) \{[\s\S]*setActiveModule\(selected\);[\s\S]*return;/);
  assert.match(app, /securityLoaded && !security && securityPanelOpen && <PinSetup/);
  assert.doesNotMatch(app, /securityLoaded && !security && <PinSetup/);
  assert.match(app, /activeRole=\{role \?\? \(!security \? "owner" : null\)\}/);
  assert.match(app, /!security \? "دانانی PIN"/);
});
