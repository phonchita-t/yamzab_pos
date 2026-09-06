-- =============================================================================
--  Yam Zabb POS - PostgreSQL schema
-- =============================================================================
--  Spicy salad (ส้มตำ / ยำแซ่บ) restaurant point-of-sale.
--
--  This file is the canonical, human-readable schema. The application talks to
--  the database through Prisma (server/prisma/schema.prisma) whose migrations
--  produce an equivalent structure. Use this file for review, for standing up a
--  database by hand, or as the source of truth when reasoning about the model.
--
--  Apply with:   psql "$DATABASE_URL" -f database/schema.sql
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive text (emails)

-- -----------------------------------------------------------------------------
--  Enums
-- -----------------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('ADMIN', 'CASHIER');
CREATE TYPE order_status      AS ENUM ('PENDING', 'PREPARING', 'COMPLETED', 'CANCELLED');
CREATE TYPE payment_method    AS ENUM ('CASH', 'QR_PROMPTPAY', 'CREDIT_CARD');
CREATE TYPE payment_status    AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'VOID');
CREATE TYPE spice_level       AS ENUM ('NONE', 'MILD', 'MEDIUM', 'HOT', 'THAI_HOT', 'EXTRA_THAI_HOT');
CREATE TYPE loyalty_txn_type  AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE');
CREATE TYPE stock_move_type   AS ENUM ('PURCHASE', 'SALE', 'WASTE', 'ADJUSTMENT');

-- -----------------------------------------------------------------------------
--  Staff & RBAC
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      CITEXT NOT NULL UNIQUE,
    full_name     TEXT   NOT NULL,
    email         CITEXT UNIQUE,
    password_hash TEXT   NOT NULL,                 -- bcrypt
    role          user_role NOT NULL DEFAULT 'CASHIER',
    pin_code      TEXT,                            -- optional 4-6 digit hash for quick POS switch
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
--  Menu: categories, products, and the option groups used for customisation
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,                    -- e.g. "Yam / Spicy Salads"
    name_th      TEXT,
    slug         TEXT NOT NULL UNIQUE,
    color        TEXT NOT NULL DEFAULT '#ef4444',  -- tile colour on the POS grid
    icon         TEXT,                             -- emoji or icon key
    sort_order   INT  NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id   UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    sku           TEXT UNIQUE,
    name          TEXT NOT NULL,
    name_th       TEXT,
    description   TEXT,
    price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    cost          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    image_url     TEXT,
    -- customisation toggles: which option groups apply to this dish
    allows_spice      BOOLEAN NOT NULL DEFAULT FALSE,
    allows_pla_ra     BOOLEAN NOT NULL DEFAULT FALSE,   -- fermented fish sauce (ปลาร้า)
    allows_protein    BOOLEAN NOT NULL DEFAULT FALSE,
    default_spice     spice_level NOT NULL DEFAULT 'MEDIUM',
    is_available      BOOLEAN NOT NULL DEFAULT TRUE,    -- 86'd / sold out toggle
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    track_inventory   BOOLEAN NOT NULL DEFAULT FALSE,
    stock_qty         NUMERIC(10,2) NOT NULL DEFAULT 0,
    reorder_level     NUMERIC(10,2) NOT NULL DEFAULT 0,
    sort_order        INT NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active   ON products(is_active, is_available);

-- Reusable option groups (Protein choice, Add-ons, ...) and their options.
-- Spice level and Pla Ra are modelled as first-class columns on order_items
-- because every yam shares them; anything else lives here.
CREATE TABLE option_groups (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,                  -- "Protein", "Extra toppings"
    name_th        TEXT,
    min_select     INT NOT NULL DEFAULT 0,
    max_select     INT NOT NULL DEFAULT 1,
    is_required    BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order     INT NOT NULL DEFAULT 0
);

CREATE TABLE options (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,                 -- "Soft-shell crab", "Salted egg"
    name_th         TEXT,
    price_delta     NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0
);

CREATE TABLE product_option_groups (
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    option_group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, option_group_id)
);

-- -----------------------------------------------------------------------------
--  Membership & loyalty
-- -----------------------------------------------------------------------------
CREATE TABLE membership_tiers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL UNIQUE,        -- "Silver", "Gold", "Zabb Master"
    min_points        INT  NOT NULL DEFAULT 0,     -- lifetime points to reach tier
    discount_percent  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    points_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    color             TEXT NOT NULL DEFAULT '#9ca3af',
    sort_order        INT NOT NULL DEFAULT 0
);

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           TEXT NOT NULL UNIQUE,          -- primary lookup key at checkout
    full_name       TEXT,
    email           CITEXT,
    birthdate       DATE,
    tier_id         UUID REFERENCES membership_tiers(id) ON DELETE SET NULL,
    points_balance  INT  NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
    lifetime_points INT  NOT NULL DEFAULT 0,
    lifetime_spend  NUMERIC(12,2) NOT NULL DEFAULT 0,
    visit_count     INT  NOT NULL DEFAULT 0,
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_phone ON customers(phone);

CREATE TABLE loyalty_transactions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id     UUID,                             -- FK added after orders table
    type         loyalty_txn_type NOT NULL,
    points       INT NOT NULL,                     -- +earn / -redeem
    balance_after INT NOT NULL,
    note         TEXT,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_customer ON loyalty_transactions(customer_id);

-- -----------------------------------------------------------------------------
--  Loyalty program configuration (single-row table)
-- -----------------------------------------------------------------------------
CREATE TABLE loyalty_config (
    id                   INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    points_per_currency  NUMERIC(6,3) NOT NULL DEFAULT 0.1,   -- earn 1 pt per 10 THB
    currency_per_point   NUMERIC(6,3) NOT NULL DEFAULT 1.0,   -- 1 pt redeems for 1 THB
    min_redeem_points    INT NOT NULL DEFAULT 50,
    max_redeem_percent   NUMERIC(5,2) NOT NULL DEFAULT 50,    -- cap redemption at % of bill
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO loyalty_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
--  Orders
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number      BIGINT GENERATED ALWAYS AS IDENTITY,   -- human-friendly ticket #
    cashier_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
    status            order_status NOT NULL DEFAULT 'PENDING',
    order_type        TEXT NOT NULL DEFAULT 'DINE_IN',       -- DINE_IN | TAKEAWAY | DELIVERY
    table_label       TEXT,

    subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,      -- sum of line totals
    discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,      -- manual + tier discount
    tier_discount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    points_redeemed   INT NOT NULL DEFAULT 0,
    points_value      NUMERIC(10,2) NOT NULL DEFAULT 0,      -- THB value of redeemed points
    tax_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
    service_charge    NUMERIC(10,2) NOT NULL DEFAULT 0,
    total             NUMERIC(10,2) NOT NULL DEFAULT 0,      -- amount due
    points_earned     INT NOT NULL DEFAULT 0,

    payment_status    payment_status NOT NULL DEFAULT 'PENDING',
    note              TEXT,
    placed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    prepared_at       TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_status    ON orders(status);
CREATE INDEX idx_orders_placed_at ON orders(placed_at);
CREATE INDEX idx_orders_customer  ON orders(customer_id);
CREATE INDEX idx_orders_cashier   ON orders(cashier_id);

ALTER TABLE loyalty_transactions
    ADD CONSTRAINT fk_loyalty_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE order_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id     UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    name_snapshot  TEXT NOT NULL,                  -- product name at time of sale
    unit_price     NUMERIC(10,2) NOT NULL,         -- base price snapshot
    quantity       INT NOT NULL CHECK (quantity > 0),

    -- yam customisation, captured on the line for the KDS ticket
    spice_level    spice_level NOT NULL DEFAULT 'MEDIUM',
    pla_ra         BOOLEAN NOT NULL DEFAULT FALSE, -- true = with fermented fish sauce
    options_total  NUMERIC(10,2) NOT NULL DEFAULT 0,
    line_total     NUMERIC(10,2) NOT NULL,         -- (unit_price + options_total) * qty
    note           TEXT,                           -- "no peanuts", "extra lime"
    kitchen_status order_status NOT NULL DEFAULT 'PENDING',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- selected options per line (protein choice, add-ons)
CREATE TABLE order_item_options (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    option_id     UUID REFERENCES options(id) ON DELETE SET NULL,
    name_snapshot TEXT NOT NULL,
    price_delta   NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
--  Payments / transactions  (an order may be split across tenders)
-- -----------------------------------------------------------------------------
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    method          payment_method NOT NULL,
    amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    tendered        NUMERIC(10,2),                 -- cash given
    change_given    NUMERIC(10,2) NOT NULL DEFAULT 0,
    reference       TEXT,                          -- gateway ref / PromptPay txn id
    status          payment_status NOT NULL DEFAULT 'PAID',
    processed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_order ON transactions(order_id);
CREATE INDEX idx_transactions_processed_at ON transactions(processed_at);

-- -----------------------------------------------------------------------------
--  Inventory movements (audit trail for stock changes)
-- -----------------------------------------------------------------------------
CREATE TABLE stock_movements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type         stock_move_type NOT NULL,
    quantity     NUMERIC(10,2) NOT NULL,           -- signed
    balance_after NUMERIC(10,2) NOT NULL,
    order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
    note         TEXT,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);

-- -----------------------------------------------------------------------------
--  Reporting helpers
-- -----------------------------------------------------------------------------
-- Daily sales rollup, refreshed on demand by the reports API.
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_sales AS
SELECT
    date_trunc('day', o.completed_at)          AS day,
    count(*)                                    AS order_count,
    sum(o.total)                                AS gross_sales,
    sum(o.discount_amount + o.points_value)     AS discounts,
    sum(o.points_earned)                        AS points_issued
FROM orders o
WHERE o.status = 'COMPLETED'
GROUP BY 1
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_sales_day ON daily_sales(day);

-- -----------------------------------------------------------------------------
--  updated_at triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['users','categories','products','customers','orders']
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
    END LOOP;
END$$;

COMMIT;

-- =============================================================================
--  Seed reference data (safe to run repeatedly)
-- =============================================================================
INSERT INTO membership_tiers (name, min_points, discount_percent, points_multiplier, color, sort_order)
VALUES
    ('Member',      0,    0,  1.0, '#9ca3af', 0),
    ('Silver',      500,  5,  1.0, '#94a3b8', 1),
    ('Gold',        2000, 10, 1.25,'#eab308', 2),
    ('Zabb Master', 5000, 15, 1.5, '#dc2626', 3)
ON CONFLICT (name) DO NOTHING;
