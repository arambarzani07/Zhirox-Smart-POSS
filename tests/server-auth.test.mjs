import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("server identity is fail-closed and cannot self-assign owner role", async () => {
  const [authStore, syncRoute, productionRoute] = await Promise.all([
    readFile(new URL("../db/auth-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/production/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(authStore, /ZHIROX_OWNER_EMAIL/);
  assert.match(authStore, /OWNER_EMAIL_NOT_CONFIGURED/);
  assert.match(authStore, /STAFF_ACCESS_DENIED/);
  assert.match(authStore, /role = 'owner'/);
  assert.match(authStore, /identity\.email === ownerEmail/);
  assert.match(authStore, /identity\.email !== ownerEmail/);
  assert.match(authStore, /ensureConfiguredOwner\(identity, actorId\)/);
  assert.doesNotMatch(authStore, /role:\s*identity\./);
  assert.doesNotMatch(authStore, /tenantId:\s*identity\./);

  assert.match(syncRoute, /authenticatedSingleMarketActor/);
  assert.doesNotMatch(syncRoute, /singleMarketActor\(/);
  assert.match(productionRoute, /authenticatedSingleMarketActor/);
  assert.doesNotMatch(productionRoute, /singleMarketActor\(/);
});
