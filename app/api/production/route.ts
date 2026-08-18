import { readProductionStatus, restoreCloudRevision, singleMarketActor } from "@/db/sync-store";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, private" };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: noStoreHeaders });
}

export async function GET() {
  try {
    return json(await readProductionStatus(await singleMarketActor()));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "PRODUCTION_STATUS_FAILED" }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await singleMarketActor();
    const body = await request.json() as Record<string, unknown>;
    if (body.action !== "restore") return json({ error: "INVALID_PRODUCTION_ACTION" }, 400);
    const revision = Number(body.revision);
    if (!Number.isInteger(revision) || revision < 0) return json({ error: "RESTORE_REVISION_INVALID" }, 400);
    return json(await restoreCloudRevision(actor, revision));
  } catch (error) {
    const message = error instanceof Error ? error.message : "PRODUCTION_ACTION_FAILED";
    if (message === "RESTORE_OWNER_REQUIRED") return json({ error: message }, 403);
    if (message === "RESTORE_REVISION_INVALID") return json({ error: message }, 400);
    return json({ error: message }, 503);
  }
}
