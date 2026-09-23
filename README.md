# 🌶️🥗 Yam Zabb POS

A modern, responsive Point-of-Sale for a spicy salad (ส้มตำ / ยำแซ่บ) restaurant.

- **Frontend** — React 18 + Vite, Tailwind CSS (mobile-first), Recharts
- **Data** — 100% client-side. Everything (menu, stock, orders, sales history, staff,
  members, loyalty) lives in the browser's `localStorage` — no server, no database,
  no network calls. Built for a **single device**: the app runs entirely offline
  once loaded and works as a static site on GitHub Pages.

| Capability | Admin | Cashier |
| --- | :---: | :---: |
| POS cashier screen, order customisation, payments | ✅ | ✅ |
| Member lookup & registration at checkout | ✅ | ✅ |
| Dashboard analytics & sales reports | ✅ | — |
| Menu management (items, prices, options) | ✅ | — |
| Inventory management | ✅ | — |
| Members & loyalty administration | ✅ | — |
| Staff / user management | ✅ | — |

**⚠️ Single-device / single-browser data.** There's no shared backend, so each
browser's `localStorage` is its own independent copy of the shop — orders rung
up on one device or browser profile aren't visible on another, and clearing
site data (or a private/incognito window) wipes it. This is by design for a
one-till shop; it is not a multi-terminal or multi-location POS.

---

## 1. Project structure

```
yam-zabb-pos/
├── package.json               # npm workspace + scripts
└── client/                    # React SPA — the entire app
    ├── vite.config.js         # GitHub Pages base-path handling
    ├── tailwind.config.js     # "spicy salad" palette
    └── src/
        ├── main.jsx / App.jsx           # router + providers
        ├── lib/
        │   ├── store.js                 # the "backend": all localStorage reads/writes,
        │   │                            #   seed data, checkout, reports (was Express + Prisma)
        │   ├── pricing.js                # bill + loyalty math (buildBill, resolveTier)
        │   ├── format.js, constants.js
        │   └── promptpay.js
        ├── context/        AuthContext, CartContext
        ├── components/     Modal, SpiceMeter, ProtectedRoute
        │   └── pos/        CustomizeModal, CheckoutModal, MemberPanel, PromptPayQR
        └── pages/
            ├── LoginPage.jsx            # login + role-aware redirect
            ├── POSPage.jsx              # menu grid + cart
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

### Step by step

```bash
# 1. Install
npm install

# 2. client env — direct PromptPay QR config (optional)
cp client/.env.example client/.env
#   VITE_PROMPTPAY_ID   the shop's receiving mobile no. or 13-digit National/Tax ID
#   VITE_MERCHANT_NAME  name shown above the checkout QR
#   (leave VITE_PROMPTPAY_ID blank to disable the dynamic QR)

# 3. Run it
npm run dev
```

- Web → http://localhost:5173

On first load, the app seeds itself with demo staff, menu, membership tiers,
and two demo members straight into `localStorage` — see `client/src/lib/store.js`.
No migration or seed command to run.

### Demo logins

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `password123` |
| Cashier | `cashier` | `password123` |

Demo members for the checkout flow: **0812345678** (Member tier), **0899999999** (Gold tier).

Credentials are checked and stored entirely client-side — fine for a single
till behind physical access control, but note this is not a real security
boundary (anyone with the browser's dev tools can read `localStorage`).

---

## 3. Data model overview

`client/src/lib/store.js` is the source of truth — one `localStorage` record
(`yz_pos_db_v1`) holding every "table" as a plain array/object:

| Group | Keys in the store |
| --- | --- |
| Staff & RBAC | `users` (role: `ADMIN` / `CASHIER`) |
| Menu | `categories`, `products`, `optionGroups` (options embedded) |
| Membership | `tiers`, `customers`, `loyaltyTransactions`, `loyaltyConfig` |
| Orders | `orders` (items + payments embedded per order) |
| Inventory | `stockMovements` (+ `stockQty` / `reorderLevel` on each product) |

**Order line customisation** — spice level (`NONE → EXTRA_THAI_HOT`) and Pla Ra
(fermented fish sauce) are fields directly on each order item; protein/seafood
and add-on choices are captured per line. Every choice is snapshotted at sale
time so past receipts stay accurate even if the menu changes later.

**Loyalty** — `loyaltyConfig` holds the earn/redeem rates (default: earn 1 pt /
฿10 spent, redeem 1 pt = ฿1, min 50 pts, capped at 50% of the bill). Tier is
recalculated from lifetime points after each sale; tier discount and points
multiplier apply automatically at the bill summary. This math lives in
`client/src/lib/pricing.js` and is shared by the checkout preview and the
committed order, so they can never disagree.

**Order lifecycle** — checkout marks the order `COMPLETED` immediately (no
kitchen-display handoff step, since there's only one device).

---

## 4. `client/src/lib/store.js` — the "backend"

This module is what used to be an Express + Prisma + PostgreSQL API; every
page now calls a plain synchronous function on the exported `db` object
instead of making an HTTP request. Rough map of what replaced what:

| `db.` function | Replaces (old API) |
| --- | --- |
| `login` / `logout` / `getSessionUser` | `POST /api/auth/login`, `GET /api/auth/me` |
| `getCategories`, `getProducts`, `createProduct`, `updateProduct`, `deactivateProduct`, `setProductAvailability` | `/api/menu/*` |
| `getInventory`, `recordStockMovement` | `/api/menu/inventory*` |
| `searchCustomers`, `lookupCustomerByPhone`, `getCustomer`, `createCustomer`, `adjustCustomerPoints`, `getLoyaltyConfig` | `/api/customers/*` |
| `getTiers` | `/api/tiers` |
| `checkout` | `POST /api/orders/checkout` |
| `getDashboardReport`, `getSalesReport` | `/api/reports/*` |
| `getUsers`, `createUser`, `updateUser`, `deactivateUser` | `/api/users` |

Errors are thrown as `ApiError` (`message` + `status`), so calling components
keep the same `try { ... } catch (e) { setError(e.message) }` pattern they
used with the old fetch-based client.

---

## 5. Scripts

| From repo root | Does |
| --- | --- |
| `npm run dev` | Vite dev server (`:5173`) |
| `npm run build` | production static build of the client |
| `npm run test:e2e` | Playwright end-to-end tests (see below) |

---

## 6. QA: end-to-end tests

A [Playwright](https://playwright.dev) suite drives the real client in a
browser — no backend or database to stand up first — see
[`e2e/README.md`](e2e/README.md) for the full list of covered flows and caveats.

```bash
npx playwright install chromium   # one-time
npm run test:e2e
```

`npm run test:e2e:ui` opens Playwright's interactive UI mode; `npm run test:e2e:report`
reopens the last HTML report. Tests also run in CI on every push/PR (`.github/workflows/e2e.yml`).

### Jenkins

A [`Jenkinsfile`](Jenkinsfile) at the repo root runs the same build-and-test
pipeline (install → build client → Playwright E2E → SonarQube) inside a
throwaway Node container per build. It is CI only — no deploy stage.
Requirements on the Jenkins agent:

- Docker available to the agent (the pipeline shells out to `docker` directly
  and uses `docker.image(...).inside()`, so Jenkins itself can run in a
  container too, as long as it has Docker CLI + socket access).
- Plugins: Pipeline (`workflow-aggregator`), Docker Pipeline (`docker-workflow`),
  Git, JUnit, Timestamper, AnsiColor, and (optional, for the in-Jenkins HTML
  report view) HTML Publisher.

To run Jenkins itself locally with Docker CLI access, build and run
[`jenkins/Dockerfile`](jenkins/Dockerfile) (Jenkins LTS + `docker-ce-cli`,
mounting the host's `docker.sock` so pipeline steps can launch containers on
the host's Docker daemon):

```bash
docker build -t yamzab-jenkins ./jenkins
docker run -d --name jenkins -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  yamzab-jenkins
```

Then open `http://localhost:8080`, unlock with
`docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`,
install the plugins above, and point a Pipeline job at this repo with
"Pipeline script from SCM" → the `Jenkinsfile` picks up from there.

If pipeline steps fail with a Docker "permission denied", the `docker` group
inside the image (gid `999` by default) doesn't match your host's
`docker.sock` group — rebuild with
`docker build --build-arg DOCKER_GID=$(stat -c '%g' /var/run/docker.sock) -t yamzab-jenkins ./jenkins`.

### Static analysis: SonarQube

The pipeline's last two stages run a [SonarQube](https://www.sonarsource.com/products/sonarqube/)
scan and wait on its quality gate — configuration is in [`sonar-project.properties`](sonar-project.properties)
(scans `client/src`, excludes `node_modules` and build output).

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

---

## 7. Deploying to GitHub Pages

A GitHub Actions workflow ([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml))
builds `client/` and publishes it to `https://phonchita-t.github.io/yamzab_pos/`
on every push to `main` that touches `client/`. Because the app has no
backend to reach, **this deploy just works** — login, the menu grid, checkout,
reports, everything runs against the browser's own `localStorage`.

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

Remember the single-device caveat from the top of this file: the GitHub Pages
copy and anyone else's local copy each have their own independent
`localStorage` — there's no data syncing between them.
