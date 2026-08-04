-- =============================================================================
-- Maye Mundo Belleza — Migración 001: Esquema inicial
-- PostgreSQL / Supabase
--
-- 21 tablas de aplicación (incluye profiles 1:1 con auth.users)
-- + auth.users gestionado por Supabase Auth
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'cliente');

CREATE TYPE user_status AS ENUM ('active', 'inactive');

CREATE TYPE order_status AS ENUM (
    'PAGADO',
    'PENDIENTE',
    'ENVIADO',
    'ENTREGADO',
    'CANCELADO'
);

CREATE TYPE discount_type AS ENUM ('porcentaje', 'fijo');

CREATE TYPE payment_method AS ENUM (
    'WhatsApp',
    'Web_Simulado',
    'Nequi',
    'Bancolombia'
);

CREATE TYPE payment_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded'
);

CREATE TYPE product_detail_type AS ENUM (
    'benefit',
    'usage_step',
    'ingredient'
);

CREATE TYPE contact_message_status AS ENUM (
    'new',
    'read',
    'replied',
    'archived'
);

CREATE TYPE notification_type AS ENUM (
    'order_update',
    'promotion',
    'stock_alert',
    'review_reply'
);

CREATE TYPE inventory_movement_type AS ENUM (
    'sale',
    'restock',
    'adjustment',
    'return'
);

CREATE TYPE payment_transaction_status AS ENUM (
    'pending',
    'approved',
    'declined',
    'refunded'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES — Perfil de negocio (1:1 con auth.users)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    phone       TEXT,
    role        user_role   NOT NULL DEFAULT 'cliente',
    status      user_status NOT NULL DEFAULT 'active',
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,

    CONSTRAINT profiles_name_not_empty CHECK (char_length(trim(name)) > 0)
);

COMMENT ON TABLE profiles IS 'Datos de negocio del usuario. PK = auth.users.id (patrón Supabase).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CATEGORIES — Clasificación del catálogo
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE categories (
    id          BIGSERIAL   PRIMARY KEY,
    slug        TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    description TEXT,
    image_url   TEXT,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT categories_slug_unique UNIQUE (slug),
    CONSTRAINT categories_name_unique UNIQUE (name)
);

COMMENT ON TABLE categories IS 'Categorías de productos (capilar, maquillaje, uñas, skincare).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PRODUCT_TAGS — Catálogo de etiquetas visuales
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE product_tags (
    id      SMALLSERIAL PRIMARY KEY,
    slug    TEXT        NOT NULL,
    label   TEXT        NOT NULL,

    CONSTRAINT product_tags_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE product_tags IS 'Etiquetas: nuevo, popular, oferta, agotado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PRODUCTS — Catálogo central
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE products (
    id                 BIGSERIAL       PRIMARY KEY,
    sku                TEXT,
    slug               TEXT            NOT NULL,
    name               TEXT            NOT NULL,
    description        TEXT            NOT NULL DEFAULT '',
    category_id        BIGINT          NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    brand              TEXT,
    price              NUMERIC(12, 2)  NOT NULL,
    compare_at_price   NUMERIC(12, 2),
    stock_quantity     INTEGER         NOT NULL DEFAULT 0,
    is_visible         BOOLEAN         NOT NULL DEFAULT TRUE,
    is_featured        BOOLEAN         NOT NULL DEFAULT FALSE,
    whatsapp_message   TEXT,
    search_vector      TSVECTOR,
    created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ,

    CONSTRAINT products_sku_unique UNIQUE (sku),
    CONSTRAINT products_slug_unique UNIQUE (slug),
    CONSTRAINT products_price_positive CHECK (price > 0),
    CONSTRAINT products_compare_price_positive CHECK (
        compare_at_price IS NULL OR compare_at_price > 0
    ),
    CONSTRAINT products_stock_non_negative CHECK (stock_quantity >= 0),
    CONSTRAINT products_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX idx_products_category_visible ON products (category_id, is_visible);
CREATE INDEX idx_products_slug ON products (slug);
CREATE INDEX idx_products_search ON products USING GIN (search_vector);

COMMENT ON TABLE products IS 'Productos del catálogo Maye Mundo Belleza.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PRODUCT_IMAGES — Galería multi-imagen
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE product_images (
    id           BIGSERIAL   PRIMARY KEY,
    product_id   BIGINT      NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    storage_path TEXT,
    url          TEXT        NOT NULL,
    alt_text     TEXT,
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT product_images_sort_non_negative CHECK (sort_order >= 0)
);

CREATE INDEX idx_product_images_product ON product_images (product_id, sort_order);

COMMENT ON TABLE product_images IS 'Imágenes de producto. sort_order = 0 es la imagen principal.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PRODUCT_DETAILS — Beneficios, modo de uso, ingredientes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE product_details (
    id          BIGSERIAL           PRIMARY KEY,
    product_id  BIGINT              NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    detail_type product_detail_type NOT NULL,
    content     TEXT                NOT NULL,
    sort_order  INTEGER             NOT NULL DEFAULT 0,

    CONSTRAINT product_details_content_not_empty CHECK (char_length(trim(content)) > 0)
);

CREATE INDEX idx_product_details_product ON product_details (product_id, detail_type, sort_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. PRODUCT_TAG_ASSIGNMENTS — Puente producto ↔ etiqueta (N:M)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE product_tag_assignments (
    product_id BIGINT    NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    tag_id     SMALLINT  NOT NULL REFERENCES product_tags (id) ON DELETE CASCADE,

    PRIMARY KEY (product_id, tag_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RELATED_PRODUCTS — Productos relacionados (N:M reflexiva)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE related_products (
    product_id         BIGINT  NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    related_product_id BIGINT  NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    sort_order         INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (product_id, related_product_id),
    CONSTRAINT related_products_not_self CHECK (product_id <> related_product_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ADDRESSES — Direcciones de envío del usuario
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE addresses (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    label           TEXT,
    recipient_name  TEXT        NOT NULL,
    phone           TEXT,
    address_line    TEXT        NOT NULL,
    city            TEXT        NOT NULL,
    department      TEXT,
    postal_code     TEXT,
    is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CARTS — Carrito persistente (1:1 por usuario)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE carts (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT carts_user_unique UNIQUE (user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. CART_ITEMS — Líneas del carrito
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE cart_items (
    id         BIGSERIAL PRIMARY KEY,
    cart_id    UUID    NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
    product_id BIGINT  NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    quantity   INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT cart_items_cart_product_unique UNIQUE (cart_id, product_id)
);

CREATE INDEX idx_cart_items_cart ON cart_items (cart_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. WISHLIST_ITEMS — Lista de deseos (N:M usuario ↔ producto)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE wishlist_items (
    user_id    UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    product_id BIGINT      NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, product_id)
);

CREATE INDEX idx_wishlist_items_user ON wishlist_items (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. COUPONS — Cupones de descuento
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE coupons (
    id            UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    code          TEXT            NOT NULL,
    type          discount_type   NOT NULL,
    value         NUMERIC(12, 2)  NOT NULL,
    min_purchase  NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    max_uses      INTEGER,
    current_uses  INTEGER         NOT NULL DEFAULT 0,
    expires_at    TIMESTAMPTZ,
    is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
    description   TEXT            NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,

    CONSTRAINT coupons_code_unique UNIQUE (code),
    CONSTRAINT coupons_value_positive CHECK (value > 0),
    CONSTRAINT coupons_min_purchase_non_negative CHECK (min_purchase >= 0),
    CONSTRAINT coupons_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0),
    CONSTRAINT coupons_current_uses_non_negative CHECK (current_uses >= 0)
);

CREATE INDEX idx_coupons_code ON coupons (code);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. ORDERS — Pedidos confirmados
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE orders (
    id                   UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number         TEXT            NOT NULL,
    user_id              UUID            REFERENCES profiles (id) ON DELETE SET NULL,
    status               order_status    NOT NULL DEFAULT 'PENDIENTE',
    subtotal             NUMERIC(12, 2)  NOT NULL,
    shipping_cost        NUMERIC(12, 2)  NOT NULL DEFAULT 8000,
    discount_amount      NUMERIC(12, 2)  NOT NULL DEFAULT 0,
    total                NUMERIC(12, 2)  NOT NULL,
    coupon_id            UUID            REFERENCES coupons (id) ON DELETE SET NULL,
    payment_method       payment_method  NOT NULL,
    payment_status       payment_status  NOT NULL DEFAULT 'pending',
    shipping_address_id  UUID            REFERENCES addresses (id) ON DELETE SET NULL,
    shipping_snapshot    JSONB,
    customer_name        TEXT            NOT NULL,
    customer_phone       TEXT            NOT NULL,
    customer_email       TEXT,
    notes                TEXT,
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT orders_order_number_unique UNIQUE (order_number),
    CONSTRAINT orders_subtotal_non_negative CHECK (subtotal >= 0),
    CONSTRAINT orders_shipping_non_negative CHECK (shipping_cost >= 0),
    CONSTRAINT orders_discount_non_negative CHECK (discount_amount >= 0),
    CONSTRAINT orders_total_positive CHECK (total > 0)
);

CREATE INDEX idx_orders_user_status ON orders (user_id, status);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. ORDER_ITEMS — Líneas del pedido (snapshot inmutable)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE order_items (
    id           BIGSERIAL      PRIMARY KEY,
    order_id     UUID           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id   BIGINT         REFERENCES products (id) ON DELETE SET NULL,
    product_name TEXT           NOT NULL,
    product_sku  TEXT,
    unit_price   NUMERIC(12, 2) NOT NULL,
    quantity     INTEGER        NOT NULL,
    line_total   NUMERIC(12, 2) NOT NULL,
    image_url    TEXT,

    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_positive CHECK (unit_price > 0),
    CONSTRAINT order_items_line_total_positive CHECK (line_total > 0)
);

CREATE INDEX idx_order_items_order ON order_items (order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. ORDER_STATUS_HISTORY — Auditoría de cambios de estado
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE order_status_history (
    id           BIGSERIAL    PRIMARY KEY,
    order_id     UUID         NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    from_status  order_status,
    to_status    order_status NOT NULL,
    changed_by   UUID         REFERENCES profiles (id) ON DELETE SET NULL,
    note         TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_status_history_order ON order_status_history (order_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. PAYMENT_TRANSACTIONS — Transacciones de pasarela de pago
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE payment_transactions (
    id           UUID                       PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id     UUID                       NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    gateway      TEXT                       NOT NULL,
    external_id  TEXT,
    amount       NUMERIC(12, 2)             NOT NULL,
    currency     TEXT                       NOT NULL DEFAULT 'COP',
    status       payment_transaction_status NOT NULL DEFAULT 'pending',
    raw_response JSONB,
    created_at   TIMESTAMPTZ                NOT NULL DEFAULT NOW(),

    CONSTRAINT payment_transactions_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_payment_transactions_order ON payment_transactions (order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. COUPON_REDEMPTIONS — Registro de uso de cupones
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE coupon_redemptions (
    id                BIGSERIAL      PRIMARY KEY,
    coupon_id         UUID           NOT NULL REFERENCES coupons (id) ON DELETE CASCADE,
    user_id           UUID           REFERENCES profiles (id) ON DELETE SET NULL,
    order_id          UUID           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    discount_applied  NUMERIC(12, 2) NOT NULL,
    redeemed_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT coupon_redemptions_order_unique UNIQUE (order_id),
    CONSTRAINT coupon_redemptions_discount_non_negative CHECK (discount_applied >= 0)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. REVIEWS — Reseñas y calificaciones
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE reviews (
    id          BIGSERIAL   PRIMARY KEY,
    product_id  BIGINT      NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    order_id    UUID        REFERENCES orders (id) ON DELETE SET NULL,
    rating      SMALLINT    NOT NULL,
    title       TEXT,
    comment     TEXT,
    is_approved BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT reviews_user_product_order_unique UNIQUE (user_id, product_id, order_id)
);

CREATE INDEX idx_reviews_product_approved ON reviews (product_id, is_approved);

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. INVENTORY_MOVEMENTS — Trazabilidad de stock
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE inventory_movements (
    id              BIGSERIAL               PRIMARY KEY,
    product_id      BIGINT                  NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    movement_type   inventory_movement_type NOT NULL,
    quantity_change INTEGER                 NOT NULL,
    stock_after     INTEGER                 NOT NULL,
    reference_type  TEXT,
    reference_id    TEXT,
    created_by      UUID                    REFERENCES profiles (id) ON DELETE SET NULL,
    note            TEXT,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT inventory_movements_stock_after_non_negative CHECK (stock_after >= 0)
);

CREATE INDEX idx_inventory_movements_product ON inventory_movements (product_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. NOTIFICATIONS — Alertas in-app
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE notifications (
    id         UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID              NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    type       notification_type NOT NULL,
    title      TEXT              NOT NULL,
    body       TEXT              NOT NULL,
    data       JSONB,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. CONTACT_MESSAGES — Mensajes del formulario de contacto
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE contact_messages (
    id          BIGSERIAL              PRIMARY KEY,
    first_name  TEXT                   NOT NULL,
    last_name   TEXT                   NOT NULL,
    email       TEXT                   NOT NULL,
    phone       TEXT,
    subject     TEXT                   NOT NULL,
    message     TEXT                   NOT NULL,
    status      contact_message_status NOT NULL DEFAULT 'new',
    replied_by  UUID                   REFERENCES profiles (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_status ON contact_messages (status, created_at DESC);
