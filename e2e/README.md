# QA: end-to-end tests (Playwright)

E2E tests that drive the real React client in a browser. The app is fully
client-side (React + `localStorage`, see `client/src/lib/store.js`) — there's
no API or database to stand up. Each test gets a fresh browser context, so it
starts from the same seeded demo data every time (staff, menu, tiers, two
demo members) with no cross-test collisions.

## What's covered

| File | Covers |
| --- | --- |
| `tests/auth.spec.js` | Login (admin/cashier), bad credentials, route guarding, logout |
| `tests/pos-order-flow.spec.js` | Cash checkout of a simple item → receipt |
| `tests/pos-customize.spec.js` | Required option group, spice level, Pla Ra toggle, note |
| `tests/member-checkout.spec.js` | Member lookup + tier discount, inline registration of a new member |
| `tests/admin-dashboard.spec.js` | Dashboard KPIs/period switch, sales report table |
| `tests/menu-management.spec.js` | Create/edit a product, 86 / un-86 toggle |
| `tests/inventory.spec.js` | Stock purchase movement updates quantity |
| `tests/staff-management.spec.js` | Create/edit/deactivate a staff account |
| `tests/members-admin.spec.js` | Manual loyalty point adjustment + ledger entry |

## Prerequisites

`npx playwright install chromium` (one-time, downloads the browser binary). Nothing else — no database, no `.env`.

## Running

```bash
npm run test:e2e            # headless, runs against a fresh dev server it spawns for you
npm run test:e2e:ui         # interactive UI mode — great for authoring/debugging
npm run test:e2e:report     # open the last HTML report
```

By default the config's `webServer` boots `npm run dev` (the Vite dev server)
for you and waits for it to respond before running tests (see
`playwright.config.js` at the repo root). If you already have it running,
Playwright reuses it instead of starting a second copy (set `CI=true` to
force a fresh instance, as the GitHub Actions workflow does).

## Notes & caveats

- **Demo accounts** (`admin` / `cashier`, password `password123`) and the two
  demo member phone numbers come from the seed data in
  `client/src/lib/store.js` — see `e2e/support/fixtures.js` for the constants
  tests rely on. If you change the seed data, update both.
- **Single worker, one browser**: the suite runs serially in Chromium only.
