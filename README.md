# Zhirox Smart POS

Zhirox Smart POS is a Kurdish Sorani RTL retail point-of-sale system built for reliable offline-first operation with cloud synchronization and production safety controls.

## Architecture

- Next.js / React frontend with TypeScript.
- Cloudflare/Vinext runtime.
- Cloudflare D1 for server-side sync state.
- IndexedDB/local persistence for offline POS operation.
- Server-authoritative staff authorization for cloud APIs.
- GitHub Actions validation for lint, typecheck, build/tests, deployable artifact validation, and production dependency audit.

## Production security

The cloud sync and production APIs require trusted hosting identity and resolve roles from server-side staff state. The deployment must configure `ZHIROX_OWNER_EMAIL` as the canonical owner identity. See `SECURITY.md` for the complete baseline.

## Frontend module boundaries

Large workspace behavior is being decomposed by responsibility without changing the approved UI or transaction behavior. Shared formatting/date/currency helpers live under `app/workspace/format.ts`, while product CSV parsing/import validation lives under `app/workspace/csv-products.ts`. New workspace logic should prefer dedicated modules rather than adding more unrelated helpers to `app/module-workspace.tsx`.

## Development checks

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run validate:artifact
npm audit --omit=dev --audit-level=high
```

Do not merge production-sensitive changes unless these checks are successful.
