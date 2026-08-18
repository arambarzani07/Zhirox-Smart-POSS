import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cashier and accountant cloud scopes never expose user credential records", async () => {
  const contract = await readFile(new URL("../lib/production-contract.ts", import.meta.url), "utf8");

  const cashierRead = contract.match(/const cashierRead:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] ?? "";
  const accountantRead = contract.match(/const accountantRead:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] ?? "";
  const cashierWrite = contract.match(/const cashierWrite:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] ?? "";
  const accountantWrite = contract.match(/const accountantWrite:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] ?? "";

  assert.ok(cashierRead);
  assert.ok(accountantRead);
  assert.doesNotMatch(cashierRead, /"users"/);
  assert.doesNotMatch(accountantRead, /"users"/);
  assert.doesNotMatch(cashierWrite, /"users"/);
  assert.doesNotMatch(accountantWrite, /"users"/);
  assert.match(contract, /const allStores[\s\S]*"users"/);
});

test("configured owner rotation disables stale active owner rows", async () => {
  const authStore = await readFile(new URL("../db/auth-store.ts", import.meta.url), "utf8");
  assert.match(authStore, /role = 'owner' AND actor_id <> \? AND active = 1/);
  assert.match(authStore, /SET active = 0/);
  assert.match(authStore, /ZHIROX_OWNER_EMAIL/);
});
