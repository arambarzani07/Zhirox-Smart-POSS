import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta = /"codex-preview"\s*:\s*"development"/;

test("keeps development preview metadata in the Next root layout", async () => {
  const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layoutSource, developmentPreviewMeta);
  assert.match(layoutSource, /lang="ckb"/);
  assert.match(layoutSource, /dir="rtl"/);
});

test("keeps the single-market dashboard at exactly twenty-one visible modules", async () => {
  const source = await readFile(new URL("../app/pos-app.tsx", import.meta.url), "utf8");
  const moduleBlock = source.match(/const modules: ModuleDefinition\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(moduleBlock, "module definition block should exist");
  const visibleKeys = moduleBlock[1]
    .split("\n")
    .filter((line) => line.includes('{ key:') && !line.includes("hidden: true"))
    .map((line) => line.match(/key: "([^"]+)"/)?.[1]);

  assert.deepEqual(visibleKeys, [
    "cashier", "products", "debts", "customers",
    "sales", "warehouse", "purchases", "suppliers",
    "cashIn", "salesReturns", "purchaseReturns", "cashOut", "expenses",
    "reports", "accounting", "losses", "labels", "audit",
    "backup", "settings", "help",
  ]);
});

test("packages single-market sync for the current Next standalone runtime without caching API responses", async () => {
  const [hostingText, nextConfigSource, routeSource, productionRouteSource, serviceWorkerSource, syncStoreSource] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/production/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../db/sync-store.ts", import.meta.url), "utf8"),
  ]);
  assert.equal(JSON.parse(hostingText).d1, "DB");
  assert.match(nextConfigSource, /output:\s*"standalone"/);
  assert.match(routeSource, /singleMarketActor/);
  assert.match(routeSource, /SyncConflictError/);
  assert.match(productionRouteSource, /restoreCloudRevision/);
  assert.match(syncStoreSource, /DatabaseSync/);
  assert.match(syncStoreSource, /status = 'completed'/);
  assert.match(syncStoreSource, /mergeConcurrentSyncState/);
  assert.match(syncStoreSource, /CREATE TABLE IF NOT EXISTS pos_staff/);
  assert.match(syncStoreSource, /CREATE TABLE IF NOT EXISTS pos_devices/);
  assert.match(syncStoreSource, /CREATE TABLE IF NOT EXISTS pos_restore_points/);
  assert.match(serviceWorkerSource, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("posts immutable balanced journals for every financial and inventory mutation", async () => {
  const [databaseSource, moneySource, syncContractSource, workspaceSource, serviceWorkerSource, securitySource, intelligenceSource, globalsSource] = await Promise.all([
    readFile(new URL("../lib/pos-db.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pos-money.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/sync-contract.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/module-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/device-security.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/offline-intelligence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(databaseSource, /const DB_VERSION = 13/);
  assert.match(databaseSource, /export function buildBalancedJournalEntry/);
  assert.match(moneySource, /Math\.abs\(debitTotalIQD - creditTotalIQD\) > 0\.001/);
  assert.match(syncContractSource, /"journalEntries"/);
  assert.match(serviceWorkerSource, /zhirox-pos-shell-v60/);
  assert.match(workspaceSource, /replaceProductCatalog/);
  assert.match(workspaceSource, /zhirox\.catalog-reset\.v60/);
  assert.match(workspaceSource, /sellingpriceiqd/);
  assert.match(workspaceSource, /initialquantity/);
  assert.match(workspaceSource, /lowstockalert/);
  assert.match(workspaceSource, /supermarket-zhirox-import\.csv/);
  assert.match(databaseSource, /openCursor\(\)/);
  assert.match(databaseSource, /LocalSafetyBackupSummary/);
  assert.match(securitySource, /PIN security has been retired/);
  assert.match(securitySource, /return null/);
  assert.match(databaseSource, /zhirox\.active-operator\.v1/);
  assert.match(databaseSource, /assertAccountingPeriodOpen/);
  assert.match(databaseSource, /period\.closed/);
  assert.match(workspaceSource, /ڕاپۆرتی بەسەرچوونی بەچ/);
  assert.match(workspaceSource, /zhirox-expiry-batches/);
  assert.match(workspaceSource, /PENDING_LOSS_BATCH_KEY/);
  assert.match(workspaceSource, /داشبۆردی قازانجی کالا و بەچ/);
  assert.match(workspaceSource, /zhirox-product-profit/);
  assert.match(workspaceSource, /پێشبینی کەمبوون و داواکاری کڕین/);
  assert.match(workspaceSource, /zhirox-reorder-plan/);
  assert.match(workspaceSource, /print-purchase-order/);
  assert.match(workspaceSource, /زنجیرەی پەسەندی خاوەن/);
  assert.match(workspaceSource, /approval\.applied/);
  assert.match(workspaceSource, /approval\.expired/);
  assert.match(workspaceSource, /هەڵبژاردنی فایلی \.BAK/);
  assert.match(workspaceSource, /SHA-256/);
  assert.match(workspaceSource, /زیرەکی ناوخۆ/);
  assert.match(intelligenceSource, /buildOfflineInsights/);
  assert.match(intelligenceSource, /offlineHealthScore/);
  assert.match(workspaceSource, /بەدواداچوونی گارانتی/);
  assert.match(workspaceSource, /WarrantyForm/);
  assert.match(databaseSource, /WarrantyRecord/);
  assert.match(databaseSource, /activeProductSalePrice/);
  assert.match(workspaceSource, /کەمترین نرخی ڕێگەپێدراو/);
  assert.match(workspaceSource, /نرخی ئۆفەر/);
  assert.match(workspaceSource, /ناوەندی ئاگاداری و ئەرکەکان/);
  assert.match(workspaceSource, /alert\.snoozed/);
  assert.match(databaseSource, /stockBatches/);
  assert.match(databaseSource, /eligibleBatches/);
  assert.match(databaseSource, /batchAllocations/);
  assert.match(workspaceSource, /ژمارەی بەچ/);
  assert.match(workspaceSource, /بەهای بەسەرچوو/);
  assert.match(workspaceSource, /بەچی خەساربوو/);
  assert.match(databaseSource, /stockBatchId: selectedBatch/);

  for (const sourceType of [
    "sale", "saleReturn", "purchase", "purchaseReturn", "expense", "cash",
    "loss", "stockAdjustment", "stocktake", "productImport", "recordOpening",
  ]) {
    assert.match(databaseSource, new RegExp(`sourceType: "${sourceType}"`));
  }

  assert.match(workspaceSource, /Trial Balance/);
  assert.match(workspaceSource, /مێژووی تۆمارە نەگۆڕەکان/);
  assert.match(workspaceSource, /usdToIqdRate/);
  assert.match(databaseSource, /paymentCurrency/);
  assert.match(databaseSource, /openingCashUSD/);
  assert.match(databaseSource, /bank: \{ code: "1120"/);
  assert.match(databaseSource, /salesDiscounts: \{ code: "4120"/);
  assert.match(workspaceSource, /شێوازی پارەدان/);
  assert.match(workspaceSource, /ناوەندی قەرزی کڕیار، دانەوە و کشفی حساب/);
  assert.match(workspaceSource, /مێژووی قەرز و دانەوە/);
  assert.match(workspaceSource, /هۆکاری گەڕاندنەوە/);
  assert.match(workspaceSource, /zhirox-safety-before-restore/);
  assert.match(workspaceSource, /پاشەکەوتی خۆکاری ناوخۆ/);
  assert.match(databaseSource, /createLocalSafetyBackup\("داخستنی شەفت"\)/);
  assert.match(databaseSource, /slice\(30\)/);
  assert.match(databaseSource, /کاتێک قاسە جیاوازی هەیە، نووسینی هۆکار ناچارییە/);
  assert.match(workspaceSource, /discount-control/);
  assert.match(globalsSource, /Locked design system refinement/);
  assert.match(workspaceSource, /نزیکترین بەرواری بەسەرچوون/);
  assert.match(workspaceSource, /بەسەرچوو/);
  assert.match(databaseSource, /بەسەرچووە و فرۆشتنی ڕێگەپێنەدراوە/);
  assert.match(databaseSource, /paymentMethod === "cash" \? JOURNAL_ACCOUNTS\.cash : JOURNAL_ACCOUNTS\.bank/);
  assert.match(workspaceSource, /treasury-form/);
  assert.match(workspaceSource, /جووڵەی خاوێنی بانک/);
});
