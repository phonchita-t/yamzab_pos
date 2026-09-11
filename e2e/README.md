# QA: end-to-end tests (Playwright)

Full-stack E2E tests that drive the real React client against the real Express
API and a real PostgreSQL database — no mocks. They cover the flows in the
capability table in the root README: login/RBAC, POS checkout, KDS, member
loyalty, and the admin menu/inventory/staff/reports screens.

## What's covered

| File | Covers |
| --- | --- |
| `tests/auth.spec.js` | Login (admin/cashier), bad credentials, route guarding, logout |
| `tests/pos-order-flow.spec.js` | Cash checkout of a simple item → receipt → KDS pending → preparing → completed |
| `tests/pos-customize.spec.js` | Required option group, spice level, Pla Ra toggle, note |
| `tests/member-checkout.spec.js` | Member lookup + tier discount, inline registration of a new member |
| `tests/admin-dashboard.spec.js` | Dashboard KPIs/period switch, sales report table |
| `tests/menu-management.spec.js` | Create/edit a product, 86 / un-86 toggle |
| `tests/inventory.spec.js` | Stock purchase movement updates quantity |
| `tests/staff-management.spec.js` | Create/edit/deactivate a staff account |
| `tests/members-admin.spec.js` | Manual loyalty point adjustment + ledger entry |
| `tests/api-rbac.spec.js` | API-level auth/RBAC contract and checkout validation (no browser) |

## Prerequisites

1. PostgreSQL running and migrated + seeded:
   ```bash
   docker compose up -d
   npm run prisma:deploy --workspace server   # or: npm run db:migrate
   npm run db:seed
   ```
2. `npx playwright install chromium` (one-time, downloads the browser binary).

## Running

```bash
npm run test:e2e            # headless, runs against a fresh dev server it spawns for you
npm run test:e2e:ui         # interactive UI mode — great for authoring/debugging
npm run test:e2e:report     # open the last HTML report
```

By default the config's `webServer` boots `npm run dev:server` and
`npm run dev:client` for you and waits for both to respond before running
tests (see `playwright.config.js` at the repo root). If you already have
`npm run dev` running, Playwright reuses it instead of starting a second copy
(set `CI=true` to force a fresh instance, as the GitHub Actions workflow does).

## Notes & caveats

- **Not hermetic**: these tests run against whatever database `DATABASE_URL`
  points at and create real rows (a test product, a test staff account, a
  test member, a few point adjustments) with timestamp-suffixed names so
  repeated runs don't collide. Point this at a disposable dev/CI database,
  never at production data. `npm run db:reset` gives you a clean slate.
- **Demo accounts** (`admin` / `cashier`, password `password123`) and the two
  demo member phone numbers come from `server/prisma/seed.js` — see
  `e2e/support/fixtures.js` for the constants tests rely on. If you change
  the seed data, update both.
- **Single worker, one browser**: the suite runs serially in Chromium only.
  The KDS/checkout flow especially assumes no other process is racing it for
  order numbers or kitchen state. Parallelizing would need per-test data
  isolation (e.g. a transactionally-rolled-back DB per worker) that this
  project's stack doesn't set up yet.
