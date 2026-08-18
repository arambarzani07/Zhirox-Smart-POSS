import { env } from "cloudflare:workers";
import { actorIdForEmail, ensureSyncSchema } from "@/db/sync-store";
import type { PosRole, ServerStaffProfile } from "@/lib/production-contract";
import type { AuthenticatedIdentity } from "@/lib/request-security";

const TENANT_ID = "main-market";
const MARKET_NAME = "Zhirox Smart POS";

type StaffRow = {
  actorId: string;
  email: string;
  displayName: string;
  role: PosRole;
  active: number;
  createdAt: string;
  updatedAt: string;
};

function database() {
  if (!env.DB) throw new Error("SYNC_DATABASE_UNAVAILABLE");
  return env.DB;
}

function runtimeString(name: string) {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" ? value.trim() : "";
}

function configuredOwnerEmail() {
  const email = runtimeString("ZHIROX_OWNER_EMAIL").toLowerCase();
  if (!email || email.length > 320 || !email.includes("@")) {
    throw new Error("OWNER_EMAIL_NOT_CONFIGURED");
  }
  return email;
}

function toProfile(row: StaffRow): ServerStaffProfile {
  return {
    tenantId: TENANT_ID,
    marketName: MARKET_NAME,
    actorId: row.actorId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    active: row.active === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function readStaff(actorId: string) {
  return database().prepare(`SELECT actor_id AS actorId, email, display_name AS displayName, role, active,
      created_at AS createdAt, updated_at AS updatedAt
    FROM pos_staff WHERE tenant_id = ? AND actor_id = ?`)
    .bind(TENANT_ID, actorId).first<StaffRow>();
}

async function ensureConfiguredOwner(identity: AuthenticatedIdentity, actorId: string) {
  if (identity.email !== configuredOwnerEmail()) return null;
  const now = new Date().toISOString();
  await database().prepare(`INSERT INTO pos_staff
      (tenant_id, actor_id, email, display_name, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'owner', 1, ?, ?)
    ON CONFLICT (tenant_id, actor_id) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name,
      role = 'owner',
      active = 1,
      updated_at = excluded.updated_at`)
    .bind(TENANT_ID, actorId, identity.email, identity.displayName, now, now).run();
  return readStaff(actorId);
}

export async function authenticatedSingleMarketActor(identity: AuthenticatedIdentity): Promise<ServerStaffProfile> {
  await ensureSyncSchema();
  const actorId = await actorIdForEmail(identity.email);
  let row = await readStaff(actorId);

  if (!row) row = await ensureConfiguredOwner(identity, actorId);
  if (!row) throw new Error("STAFF_ACCESS_DENIED");
  if (row.active !== 1) throw new Error("STAFF_ACCESS_DENIED");

  // Owner identity is anchored to deployment configuration, not request input.
  // Existing non-owner staff keep only the role already stored in D1.
  if (row.role === "owner" && identity.email !== configuredOwnerEmail()) {
    throw new Error("STAFF_ACCESS_DENIED");
  }

  if (row.email !== identity.email || row.displayName !== identity.displayName) {
    const now = new Date().toISOString();
    await database().prepare(`UPDATE pos_staff SET email = ?, display_name = ?, updated_at = ?
      WHERE tenant_id = ? AND actor_id = ?`)
      .bind(identity.email, identity.displayName, now, TENANT_ID, actorId).run();
    row = { ...row, email: identity.email, displayName: identity.displayName, updatedAt: now };
  }

  return toProfile(row);
}
