import { authenticatedSingleMarketActor } from "@/db/auth-store";
import { readProductionStatus, restoreCloudRevision } from "@/db/sync-store";
import { apiSecurityHeaders, apiSecurityResponse, readBoundedJsonObject, requireAuthenticatedIdentity, requireTrustedMutationRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: apiSecurityHeaders });
}

async function authenticatedOwner(request: Request) {
  const identity = requireAuthenticatedIdentity(request);
  const actor = await authenticatedSingleMarketActor(identity);
  if (actor.role !== "owner") throw new Error("RESTORE_OWNER_REQUIRED");
  return actor;
}

function accessFailure(error: unknown) {
  const security = apiSecurityResponse(error);
  if (security) return security;
  const message = error instanceof Error ? error.message : "PRODUCTION_ACCESS_FAILED";
  if (message === "STAFF_ACCESS_DENIED" || message === "RESTORE_OWNER_REQUIRED") return json({ error: message }, 403);
  if (message === "OWNER_EMAIL_NOT_CONFIGURED") return json({ error: message }, 503);
  return null;
}

export async function GET(request: Request) {
  try {
    return json(await readProductionStatus(await authenticatedOwner(request)));
  } catch (error) {
    const access = accessFailure(error);
    if (access) return access;
    return json({ error: error instanceof Error ? error.message : "PRODUCTION_STATUS_FAILED" }, 503);
  }
}

export async function POST(request: Request) {
  try {
    requireTrustedMutationRequest(request);
    const actor = await authenticatedOwner(request);
    const body = await readBoundedJsonObject(request, 16_384);
    if (body.action !== "restore") return json({ error: "INVALID_PRODUCTION_ACTION" }, 400);
    const revision = Number(body.revision);
    if (!Number.isInteger(revision) || revision < 0) return json({ error: "RESTORE_REVISION_INVALID" }, 400);
    return json(await restoreCloudRevision(actor, revision));
  } catch (error) {
    const access = accessFailure(error);
    if (access) return access;
    const message = error instanceof Error ? error.message : "PRODUCTION_ACTION_FAILED";
    if (message === "RESTORE_REVISION_INVALID") return json({ error: message }, 400);
    return json({ error: message }, 503);
  }
}
