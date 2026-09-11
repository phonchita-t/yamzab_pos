# 🌶️🥗 Yam Zabb POS

A modern, responsive Point-of-Sale for a spicy salad (ส้มตำ / ยำแซ่บ) restaurant.

- **Frontend** — React 18 + Vite, Tailwind CSS (mobile-first), Recharts
- **Backend** — Node.js + Express REST API, JWT auth with role-based access control
- **Database** — PostgreSQL via Prisma ORM

| Capability | Admin | Cashier |
| --- | :---: | :---: |
| POS cashier screen, order customisation, payments | ✅ | ✅ |
| Kitchen Display System (KDS) | ✅ | ✅ |
| Member lookup & registration at checkout | ✅ | ✅ |
| Dashboard analytics & sales reports | ✅ | — |
| Menu management (items, prices, options) | ✅ | — |
| Inventory management | ✅ | — |
| Members & loyalty administration | ✅ | — |
| Staff / user management | ✅ | — |

---

## 1. Project structure

```
yam-zabb-pos/
├── package.json               # npm workspaces + orchestration scripts
├── docker-compose.yml         # local PostgreSQL 16
├── database/
│   └── schema.sql             # canonical, hand-readable PostgreSQL DDL
├── server/                    # Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma      # Prisma model (mirrors database/schema.sql)
│   │   └── seed.js            # demo data: staff, menu, tiers, members
│   └── src/
│       ├── index.js           # app entry / route mounting
│       ├── config.js
│       ├── prisma.js          # shared PrismaClient
│       ├── lib/pricing.js     # bill + loyalty math (buildBill, resolveTier)
│       ├── middleware/
│       │   ├── auth.js        # authenticate + requireRole (RBAC)
│       │   └── validate.js    # asyncHandler, zod validation, error handler
│       └── routes/
│           ├── auth.routes.js
│           ├── users.routes.js       # staff management (ADMIN)
│           ├── menu.routes.js        # categories, products, inventory
│           ├── customers.routes.js   # members, loyalty, config
│           ├── orders.routes.js      # checkout, KDS, order history
│           ├── reports.routes.js     # dashboard + sales summaries (ADMIN)
│           └── tiers.routes.js       # membership tiers
└── client/                    # React SPA
    ├── vite.config.js         # dev proxy /api -> :4000
    ├── tailwind.config.js     # "spicy salad" palette
    └── src/
        ├── main.jsx / App.jsx           # router + providers
        ├── lib/            api.js, format.js, constants.js
        ├── context/        AuthContext, CartContext
        ├── components/     Modal, SpiceMeter, ProtectedRoute
        │   └── pos/        CustomizeModal, CheckoutModal, MemberPanel
        └── pages/
            ├── LoginPage.jsx            # login + role-aware redirect
            ├── POSPage.jsx              # menu grid + cart
            ├── KDSPage.jsx              # kitchen display
            └── admin/
                ├── AdminLayout.jsx      # sidebar shell
                ├── DashboardPage.jsx    # KPIs + charts
                ├── ReportsPage.jsx      # daily/weekly/monthly
                ├── MenuManagerPage.jsx
                ├── InventoryPage.jsx
                ├── MembersPage.jsx
                └── StaffPage.jsx
```

---

## 2. Setup

### Prerequisites
- Node.js **20+**
- PostgreSQL **14+** (or Docker)

### Step by step

```bash
# 1. Clone & install every workspace
npm install

# 2. Start PostgreSQL (skip if you already have one)
docker compose up -d

# 3. Configure the server
cp server/.env.example server/.env
#   edit DATABASE_URL / JWT_SECRET if needed
#   default: postgresql://postgres:postgres@localhost:5432/yam_zabb_pos

# 4. client env — API base URL (if not localhost:4000) + direct PromptPay QR
cp client/.env.example client/.env
#   VITE_PROMPTPAY_ID   the shop's receiving mobile no. or 13-digit National/Tax ID
#   VITE_MERCHANT_NAME  name shown above the checkout QR
#   (leave VITE_PROMPTPAY_ID blank to disable the dynamic QR)

# 5. Create the schema and load demo data
npm run db:migrate        # prisma migrate dev  (creates tables)
npm run db:seed           # staff, menu, tiers, sample members

# 6. Run both apps
npm run dev
```

- API → http://localhost:4000  (`GET /api/health`)
- Web → http://localhost:5173

### Demo logins

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `password123` |
| Cashier | `cashier` | `password123` |

Demo members for the checkout flow: **0812345678** (Member tier), **0899999999** (Gold tier).

### Applying the raw SQL schema instead of Prisma migrate

```bash
psql "postgresql://postgres:postgres@localhost:5432/yam_zabb_pos" -f database/schema.sql
npm run prisma:generate --workspace server   # generate the client only
```

---

## 3. Data model overview

`database/schema.sql` is the source of truth; `server/prisma/schema.prisma` mirrors it.

| Group | Tables |
| --- | --- |
| Staff & RBAC | `users` (role: `ADMIN` / `CASHIER`) |
| Menu | `categories`, `products`, `option_groups`, `options`, `product_option_groups` |
| Membership | `membership_tiers`, `customers`, `loyalty_transactions`, `loyalty_config` |
| Orders | `orders`, `order_items`, `order_item_options` |
| Payments | `transactions` (split tenders per order: `CASH` / `QR_PROMPTPAY` / `CREDIT_CARD`) |
| Inventory | `stock_movements` (+ `stock_qty` / `reorder_level` on `products`) |
| Reporting | `daily_sales` materialized view |

**Order line customisation** — spice level (`NONE → EXTRA_THAI_HOT`) and Pla Ra (fermented
fish sauce) are first-class columns on `order_items`; protein/seafood and add-on choices
are captured in `order_item_options`. Every choice is snapshotted so the KDS ticket and
receipts stay accurate even if the menu later changes.

**Loyalty** — `loyalty_config` holds the earn/redeem rates (default: earn 1 pt / ฿10 spent,
redeem 1 pt = ฿1, min 50 pts, capped at 50% of the bill). Tier is recalculated from
lifetime points after each sale; tier discount and points multiplier apply automatically
at the bill summary.

---

## 4. Key API endpoints

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | public | Get JWT + user |
| GET | `/api/menu/categories` `/api/menu/products` | any | POS menu grid |
| POST/PATCH | `/api/menu/products` | ADMIN | Menu management |
| GET | `/api/customers/lookup?phone=` | any | Member lookup at checkout |
| POST | `/api/customers` | any | Inline member registration |
| POST | `/api/orders/checkout` | CASHIER | Validate cart, price bill, take payment, post to KDS |
| GET | `/api/orders/kds` | any | Live kitchen queue |
| PATCH | `/api/orders/:id/status` | any | Pending → Preparing → Completed |
| GET | `/api/reports/dashboard?period=` | ADMIN | KPIs, revenue series, best sellers |
| GET | `/api/reports/sales?groupBy=` | ADMIN | Daily / weekly / monthly summary |
| GET/POST/PATCH | `/api/users` | ADMIN | Staff management |

The KDS uses lightweight 5-second polling; swap in SSE/WebSockets later without touching
the schema.

---

## 5. Scripts

| From repo root | Does |
| --- | --- |
| `npm run dev` | server (`:4000`) + client (`:5173`) together |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:seed` | reseed demo data |
| `npm run db:reset` | drop, re-migrate, re-seed |
| `npm run build` | production build of the client |
| `npm run test:e2e` | Playwright end-to-end tests (see below) |

---

## 6. QA: end-to-end tests

The full POS/KDS/admin flow is covered by a [Playwright](https://playwright.dev)
suite that drives the real client + API + database — see
[`e2e/README.md`](e2e/README.md) for the full list of covered flows and caveats.

```bash
docker compose up -d
npm run prisma:deploy --workspace server && npm run db:seed
npx playwright install chromium   # one-time
npm run test:e2e
```

`npm run test:e2e:ui` opens Playwright's interactive UI mode; `npm run test:e2e:report`
reopens the last HTML report. Tests also run in CI on every push/PR against a
throwaway PostgreSQL service container (`.github/workflows/e2e.yml`).

### Jenkins

A [`Jenkinsfile`](Jenkinsfile) at the repo root runs the same build-and-test
pipeline (install → generate Prisma client → migrate + seed → build client →
Playwright E2E) inside a throwaway PostgreSQL + Node containers per build. It
is CI only — no deploy stage. Requirements on the Jenkins agent:

- Docker available to the agent (the pipeline shells out to `docker` directly
  and uses `docker.image(...).withRun()` / `.inside()`, so Jenkins itself can
  run in a container too, as long as it has Docker CLI + socket access).
- Plugins: Pipeline (`workflow-aggregator`), Docker Pipeline (`docker-workflow`),
  Git, JUnit, Timestamper, AnsiColor, and (optional, for the in-Jenkins HTML
  report view) HTML Publisher.

Point a Pipeline job at this repo with "Pipeline script from SCM" → the
`Jenkinsfile` picks up from there. This pipeline was validated end-to-end
against a real Jenkins controller (all 21 Playwright tests green, JUnit trend
and HTML report both published).

### Static analysis: SonarQube

The pipeline's last two stages run a [SonarQube](https://www.sonarsource.com/products/sonarqube/)
scan and wait on its quality gate — configuration is in [`sonar-project.properties`](sonar-project.properties)
(scans `client/src` + `server/src`, excludes `node_modules`, build output and
migrations). This was also validated end-to-end against a real self-hosted
SonarQube (Community Edition): the scan completed, the quality gate came back
`OK`, and it genuinely caught 2 real bugs in the current codebase worth fixing —
see below.

**One-time Jenkins setup** (Manage Jenkins > System):

1. Install the **SonarQube Scanner** plugin.
2. Under *SonarQube servers*, add a server named exactly `SonarQube` with your
   server's URL and a **Secret text** credential holding a user token
   (SonarQube → My Account → Security → Generate Token).
3. In SonarQube, add a webhook (Administration → Webhooks) pointing at
   `<your-jenkins-url>/sonarqube-webhook/` — without this the `Quality Gate`
   stage will just time out after 5 minutes rather than fail fast.

The scanner CLI itself isn't pre-installed anywhere — the pipeline downloads
it fresh into the ephemeral build container each run (see the `SonarQube analysis`
stage), so no Jenkins-side tool configuration is needed beyond the server entry.

Don't have a SonarQube server yet? For local/dev use:

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:lts-community
# http://localhost:9000, default login admin/admin (you'll be asked to change it)
```

**Bugs SonarQube found in this codebase** (from the validation run — the two
real ones are already fixed; noting them here for context):

- ~~`client/src/components/pos/MemberPanel.jsx` used the comma operator
  (`else setError(err.message), setStatus('idle');`) instead of two
  statements~~ — fixed.
- ~~`server/src/prisma.js` had a `log:` ternary whose branches returned the
  same value~~ — fixed.
- Two `BLOCKER`-severity hits on the date-bucketing loop in
  `server/src/routes/reports.routes.js` (`for (let d = ...; d <= end; d.setDate(...))`)
  are false positives — SonarQube's loop-counter rule doesn't know `Date.setDate`
  mutates in place — safe to mark "won't fix" in SonarQube rather than changing the code.

---

## 7. Deploying the client to GitHub Pages

A GitHub Actions workflow ([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml))
builds `client/` and publishes it to `https://phonchita-t.github.io/yamzab_pos/`
on every push to `main` that touches `client/`.

**⚠️ Static hosting only.** GitHub Pages serves static files — it cannot run
the Express API or PostgreSQL. This deploy is the React SPA alone, with no
backend behind it: the UI loads and renders fully, but anything that calls
the API (login, the menu grid, checkout, reports, …) will fail with a visible
error, same as any other network failure the app already handles. To make a
fully working deployment, host `server/` somewhere reachable (Render, Railway,
Fly.io, a VPS, …) and set `VITE_API_BASE_URL` in the workflow's build step to
that URL before building the client.

**One-time setup** (can't be done from here — needs repo admin access):
in the repo's **Settings → Pages**, set **Build and deployment → Source** to
**GitHub Actions**. After that, every push to `main` touching `client/`
deploys automatically; you can also trigger it manually from the *Actions*
tab (`Deploy client to GitHub Pages` → *Run workflow*).

Implementation notes:
- `client/vite.config.js` sets `base: '/yamzab_pos/'` only when the workflow
  sets `GITHUB_PAGES=true` during build — local dev (`npm run dev`) is
  unaffected and still serves from `/`.
- `main.jsx`'s `<BrowserRouter basename={import.meta.env.BASE_URL}>` picks up
  that same base automatically, so all the app's routes resolve under
  `/yamzab_pos/` once deployed.
- The build step copies `dist/index.html` to `dist/404.html` so direct links
  into the SPA (e.g. a bookmark to `/yamzab_pos/pos`) don't 404 — GitHub Pages
  has no server-side rewrites, so this is the standard way to make
  client-side routing survive a hard refresh.
- `client/public/.nojekyll` stops GitHub Pages from running the output
  through Jekyll (which would otherwise ignore any `_`-prefixed asset).

This was validated locally end-to-end (`GITHUB_PAGES=true` build, served at
the `/yamzab_pos/` path, loaded and routed correctly in a real browser via
Playwright, login fails gracefully with no backend present as expected).
