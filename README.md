# Zhirox Smart POS

Zhirox Smart POS is a single-market, Kurdish Sorani RTL point-of-sale system with offline-first browser storage, Cloudflare D1-backed synchronization, production restore points, stock, sales, purchases, cash, customer/supplier balances, accounting records, barcode workflows, and role-aware cloud synchronization.

## Runtime requirements

- Node.js `>=22.15.0`
- Linux-compatible build environment with `bash`, `flock`, `curl`, and GNU `timeout`
- Cloudflare/OpenAI Sites runtime with D1 binding named `DB`
- Trusted hosting identity headers for protected cloud APIs

## Production owner configuration

Production must define `ZHIROX_OWNER_EMAIL` in the server/runtime environment. This value is the canonical owner identity for the single-market installation. Do not commit it to Git and do not expose it to browser code.

The server resolves authenticated identities against persisted `pos_staff` rows. Unknown or inactive staff fail closed. The configured owner is reconciled to the single active owner identity, and stale active owner rows are disabled during owner rotation.

## Security boundary

`/api/sync` and `/api/production` are server-protected endpoints. They require trusted dispatch identity, reject untrusted cross-origin/cross-site mutations, enforce JSON/body-size limits, and never trust client-submitted role or tenant metadata. Cloud restore is owner-only.

Cashier and accountant cloud scopes do not receive the `users` store because user records contain credential-derived data such as `pinHash`. See `SECURITY.md` for the production security baseline.

## Development

```bash
npm ci
npm run dev
```

## Validation

Run the same core quality gates used by CI:

```bash
npm run lint
npm run typecheck
npm test
npm run validate:artifact
npm audit --omit=dev --audit-level=high
```

`npm test` performs the verified build before running the Node test suite.

## Database and hosting

The repository uses Drizzle tooling and Cloudflare D1. `.openai/hosting.json` declares the D1 binding used by the hosted application. `drizzle.config.ts` is available for local migration generation.

```bash
npm run db:generate
```

## Architecture notes

- `app/` — UI and protected API routes
- `lib/` — POS domain logic, local database/sync contracts, security helpers
- `db/` — Cloudflare D1 synchronization and server authorization stores
- `tests/` — financial, barcode, sync, rendered UI, authorization, and role-scope regression tests
- `.github/workflows/ci.yml` — lint/typecheck/build/test/artifact/audit merge gate

The cashier UX remains single-market; tenant and role authority are server-side concerns and are never selected by the browser.
