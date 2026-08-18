# Zhirox Smart POS — Fresh V1

This repository was rebuilt from scratch on `main` to remove the legacy runtime failure chain.

## Design rules

- Server-rendered dashboard and module routes: navigation works without React hydration.
- Exactly 21 independently addressable modules under `/module/<key>`.
- No device PIN runtime.
- No service worker or stale-cache layer.
- No IndexedDB bootstrap gate.
- No fake IndexedDB fallback.
- No global sync loop.
- No Cloudflare/D1/Wrangler runtime dependency.
- No mock business records are seeded.
- Heavy business/data functionality is intentionally decoupled from navigation and will be reintroduced module-by-module behind tested interfaces.

## Validation

`npm run validate` runs lint, TypeScript, Next build, and regression tests.
