# Zhirox Smart POS Security Baseline

## Production identity

All cloud sync and production-control API routes require the trusted hosting identity header injected by the deployment platform. The browser must never choose its own role, tenant, email, or owner status in JSON, query parameters, local storage, or custom headers.

## Owner authority

`ZHIROX_OWNER_EMAIL` is deployment-only configuration and is the canonical owner identity for the single-market installation. It must be configured in the runtime environment, never committed to Git, and never exposed to client-side code. When the configured owner changes, stale active owner rows are disabled before the new configured owner is provisioned, preserving a single active owner identity.

## Staff authorization

Non-owner staff must already exist as active records in `pos_staff`. Unknown, inactive, or stale owner identities fail closed. Roles come only from persisted server-side data. The API must not accept a role or tenant from an untrusted request.

Credential-derived user records are privileged data. The cloud `users` store is readable only by owner/manager roles; cashier and accountant cloud scopes must not include it.

## Mutation protection

State-changing API calls are same-origin/same-site only, require authenticated server identity, require JSON where applicable, and enforce body-size limits using the actual received bytes rather than trusting `Content-Length` alone.

## Restore protection

Cloud restore is an owner-only production operation. A normal authenticated staff identity is insufficient.

## CI merge gate

Before production merge, CI should pass locked dependency installation, ESLint, strict TypeScript typechecking, build/tests, deployable artifact validation, and the production dependency audit. Security-hardening changes remain draft until these checks are green.

## Operational rules

- Never commit secrets, owner email configuration, tokens, or production database credentials.
- Never trust browser-provided authorization metadata.
- Keep D1 backups/restore points available before risky migrations.
- Review role store scopes whenever a new synchronized data store is introduced.
- Treat any new endpoint that changes stock, money, staff, permissions, settings, or restore state as a privileged mutation requiring explicit server authorization.
