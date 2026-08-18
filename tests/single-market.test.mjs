import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";

test("keeps one-market UX while requiring trusted identity at server API boundary", async () => {
  const [app, syncRoute, productionRoute, syncClient, security] = await Promise.all([
    readFile(new URL("../app/pos-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/production/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pos-sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/request-security.ts", import.meta.url), "utf8"),
  ]);

  // No market selector/login gate is added to the cashier UI; identity is supplied
  // by the trusted hosting dispatch and enforced server-side.
  assert.doesNotMatch(app, /LoginGate|هەڵبژاردنی مارکێت|loadMarkets|PosSession/);
  assert.match(syncRoute, /requireAuthenticatedIdentity/);
  assert.match(syncRoute, /requireTrustedMutationRequest/);
  assert.match(productionRoute, /requireAuthenticatedIdentity/);
  assert.match(productionRoute, /requireTrustedMutationRequest/);
  assert.match(security, /oai-authenticated-user-email/);
  assert.match(security, /CROSS_ORIGIN_REQUEST_DENIED/);
  assert.match(security, /AUTH_REQUIRED/);
  assert.doesNotMatch(syncClient, /X-Zhirox-Market-Id|getSelectedMarketId|switchCloudMarket/);
  await assert.rejects(access(new URL("../app/platform/page.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../app/api/markets/route.ts", import.meta.url)));
});
