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

# 4. (optional) client env — only needed if the API is not on localhost:4000
cp client/.env.example client/.env

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

🤖 Generated with [Claude Code](https://claude.com/claude-code)
