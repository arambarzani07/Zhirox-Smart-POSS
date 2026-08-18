import {
  finalizeSyncMutation,
  readCloudSyncDelta,
  readCloudSyncMeta,
  readCloudSyncState,
  stageSyncChanges,
  startSyncMutation,
  SyncConflictError,
  SyncMergeConflictError,
} from "@/db/sync-store";
import { authenticatedSingleMarketActor } from "@/db/auth-store";
import { apiSecurityHeaders, apiSecurityResponse, requireAuthenticatedIdentity, requireTrustedMutationRequest } from "@/lib/request-security";
import { SYNC_STORE_NAMES, type CloudSyncChange } from "@/lib/sync-contract";

export const dynamic = "force-dynamic";

const storeNames = new Set<string>(SYNC_STORE_NAMES);

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: apiSecurityHeaders });
}

function conflictResponse(error: SyncConflictError) {
  return json({
    error: error.message,
    currentRevision: error.currentRevision,
    conflicts: error instanceof SyncMergeConflictError ? error.conflicts : undefined,
  }, 409);
}

async function authenticatedActor(request: Request) {
  const identity = requireAuthenticatedIdentity(request);
  return authenticatedSingleMarketActor(identity);
}

function accessFailure(error: unknown) {
  const security = apiSecurityResponse(error);
  if (security) return security;
  const message = error instanceof Error ? error.message : "STAFF_ACCESS_DENIED";
  if (message === "STAFF_ACCESS_DENIED") return json({ error: message }, 403);
  if (message === "OWNER_EMAIL_NOT_CONFIGURED") return json({ error: message }, 503);
  return json({ error: "SINGLE_MARKET_UNAVAILABLE" }, 503);
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await authenticatedActor(request);
  } catch (error) {
    return accessFailure(error);
  }
  try {
    const params = new URL(request.url).searchParams;
    if (params.get("mode") === "meta") return json(await readCloudSyncMeta(actor));
    if (params.get("mode") === "delta") {
      const since = Number(params.get("since"));
      if (!Number.isInteger(since) || since < 0) return json({ error: "INVALID_SYNC_REVISION" }, 400);
      return json(await readCloudSyncDelta(actor, since));
    }
    const requested = params.has("revision") ? Number(params.get("revision")) : undefined;
    if (requested !== undefined && (!Number.isInteger(requested) || requested < 0)) {
      return json({ error: "INVALID_SYNC_REVISION" }, 400);
    }
    return json(await readCloudSyncState(actor, requested));
  } catch (error) {
    if (error instanceof SyncConflictError) return conflictResponse(error);
    return json({ error: error instanceof Error ? error.message : "SYNC_READ_FAILED" }, 503);
  }
}

export async function POST(request: Request) {
  let actor;
  try {
    requireTrustedMutationRequest(request);
    actor = await authenticatedActor(request);
  } catch (error) {
    return accessFailure(error);
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return json({ error: "CONTENT_TYPE_JSON_REQUIRED" }, 415);
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (!Number.isFinite(length) || length < 0) return json({ error: "INVALID_CONTENT_LENGTH" }, 400);
    if (length > 1_500_000) return json({ error: "SYNC_PAYLOAD_TOO_LARGE" }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const action = body.action;
  const mutationId = typeof body.mutationId === "string" ? body.mutationId : "";
  if (!mutationId || mutationId.length > 160) return json({ error: "INVALID_MUTATION_ID" }, 400);

  try {
    if (action === "start") {
      const baseRevision = Number(body.baseRevision);
      const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
      const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel : "کاشێر";
      const appVersion = Number(body.appVersion);
      const pendingCount = Number(body.pendingCount ?? 0);
      if (
        !Number.isInteger(baseRevision) || baseRevision < 0 || !deviceId || deviceId.length > 160 ||
        deviceLabel.length > 120 || !Number.isInteger(appVersion) || appVersion < 1 || appVersion > 10_000 ||
        !Number.isInteger(pendingCount) || pendingCount < 0 || pendingCount > 1_000_000
      ) return json({ error: "INVALID_SYNC_START" }, 400);
      return json(await startSyncMutation({
        mutationId,
        baseRevision,
        deviceId,
        deviceLabel,
        appVersion,
        pendingCount,
        actor,
      }));
    }

    if (action === "chunk") {
      if (!Array.isArray(body.changes) || body.changes.length > 75) return json({ error: "INVALID_SYNC_CHUNK" }, 400);
      const changes: CloudSyncChange[] = [];
      for (const candidate of body.changes) {
        if (!candidate || typeof candidate !== "object") return json({ error: "INVALID_SYNC_CHANGE" }, 400);
        const change = candidate as Record<string, unknown>;
        const upsert = change.operation === "upsert";
        const deletion = change.operation === "delete";
        if (
          (!upsert && !deletion) || typeof change.storeName !== "string" || !storeNames.has(change.storeName) ||
          typeof change.recordId !== "string" || !change.recordId || change.recordId.length > 220 ||
          (upsert && (!change.payload || typeof change.payload !== "object" || Array.isArray(change.payload))) ||
          (deletion && change.payload !== null) ||
          typeof change.digest !== "string" || !/^[a-f0-9]{64}$/.test(change.digest)
        ) return json({ error: "INVALID_SYNC_CHANGE" }, 400);
        changes.push(change as CloudSyncChange);
      }
      return json(await stageSyncChanges(actor, mutationId, changes));
    }

    if (action === "finalize") return json(await finalizeSyncMutation(actor, mutationId));
    return json({ error: "INVALID_SYNC_ACTION" }, 400);
  } catch (error) {
    if (error instanceof SyncConflictError) return conflictResponse(error);
    const message = error instanceof Error ? error.message : "SYNC_WRITE_FAILED";
    if (message.endsWith("_DENIED")) return json({ error: message }, 403);
    if (["SYNC_NEGATIVE_STOCK", "SYNC_DUPLICATE_RECEIPT", "SYNC_UNBALANCED_JOURNAL", "SYNC_RETURN_SOURCE_MISSING", "SYNC_RETURN_EXCEEDS_SOURCE"].includes(message)) {
      return json({ error: message }, 409);
    }
    return json({ error: message }, 503);
  }
}
