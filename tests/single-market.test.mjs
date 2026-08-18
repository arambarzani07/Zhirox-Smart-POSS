import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";

test("runs as one market without login or multi-market selection", async () => {
  const [app, syncRoute, productionRoute, syncClient] = await Promise.all([
    readFile(new URL("../app/pos-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/production/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pos-sync.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(app, /LoginGate|چوونەژوورەوە|هەڵبژاردنی مارکێت|loadMarkets|PosSession/);
  assert.doesNotMatch(syncRoute, /getChatGPTUser|resolveMarketContext|x-zhirox-market-id|AUTH_REQUIRED|MARKET_REQUIRED/);
  assert.doesNotMatch(productionRoute, /getChatGPTUser|resolveMarketContext|x-zhirox-market-id/);
  assert.doesNotMatch(syncClient, /X-Zhirox-Market-Id|getSelectedMarketId|switchCloudMarket/);
  await assert.rejects(access(new URL("../app/platform/page.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../app/api/markets/route.ts", import.meta.url)));
});
