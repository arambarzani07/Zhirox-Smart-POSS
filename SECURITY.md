# Zhirox Smart POS Security Baseline

## Production identity boundary

The sync and production APIs require the hosting dispatch to inject `oai-authenticated-user-email`. Client JSON, query parameters, cookies created by the app, and browser-local role state are never accepted as server identity, tenant, or role authority.

## Owner configuration

Production must define `ZHIROX_OWNER_EMAIL` as the normalized email address of the single-market owner. The server fails closed with `OWNER_EMAIL_NOT_CONFIGURED` when an unknown identity needs owner bootstrap and this value is absent or invalid.

The configured owner can be inserted into `pos_staff` automatically on first authenticated request. Existing non-owner staff are authorized only from their persisted `pos_staff` row. An authenticated user who is not configured as owner and does not have an active staff row receives `STAFF_ACCESS_DENIED`.

Never place `ZHIROX_OWNER_EMAIL` in browser code or accept an owner email from request JSON. Configure it only in the deployment/runtime environment.

## State-changing requests

`POST /api/sync` and `POST /api/production` reject cross-origin/cross-site browser requests, require JSON content type, validate content length, and return no-store security-hardened responses.

## Restore

Cloud revision restore is owner-only. A staff identity with any other role receives `RESTORE_OWNER_REQUIRED`.

## CI gate

The CI gate runs locked dependency installation, lint, build/tests, artifact validation, and a high-severity production dependency audit. Security-sensitive changes should not be merged until this gate succeeds.

## Remaining architectural rule

Server authorization must remain authoritative. New APIs must resolve identity through the same authenticated staff boundary and must never call the legacy `singleMarketActor()` helper directly. New roles must be read from persisted server state, never from client-submitted role values.
