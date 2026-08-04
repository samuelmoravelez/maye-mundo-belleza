-- =============================================================================
-- Maye Mundo Belleza — Migración 003: Row Level Security (RLS)
-- PostgreSQL / Supabase
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: verificar si el usuario autenticado es administrador
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'::user_role
          AND status = 'active'::user_status
          AND deleted_at IS NULL
    );
$$;

COMMENT ON FUNCTION public.is_admin IS
    'Retorna TRUE si auth.uid() corresponde a un administrador activo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: verificar propiedad del registro por user_id
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_owner(record_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT auth.uid() IS NOT NULL AND auth.uid() = record_user_id;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_details       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE related_products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages      ENABLE ROW LEVEL SECURITY;

-- ═════════════════════════════════════════════════════════════════════════════
-- PROFILES — usuario ve/edita el suyo; admin control total
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "profiles_select_own"
    ON profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_admin_insert"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin() OR auth.uid() = id);

CREATE POLICY "profiles_admin_delete"
    ON profiles FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIES — lectura pública; escritura solo admin
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "categories_public_read"
    ON categories FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "categories_admin_all"
    ON categories FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- PRODUCT_TAGS — lectura pública; escritura admin
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "product_tags_public_read"
    ON product_tags FOR SELECT
    TO anon, authenticated
    USING (TRUE);

CREATE POLICY "product_tags_admin_all"
    ON product_tags FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- PRODUCTS — lectura pública de visibles; admin CRUD completo
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "products_public_read"
    ON products FOR SELECT
    TO anon, authenticated
    USING (
        (is_visible = TRUE AND deleted_at IS NULL)
        OR public.is_admin()
    );

CREATE POLICY "products_admin_all"
    ON products FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- PRODUCT_IMAGES — lectura pública; escritura admin
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "product_images_public_read"
    ON product_images FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM products p
            WHERE p.id = product_images.product_id
              AND p.is_visible = TRUE
              AND p.deleted_at IS NULL
        )
        OR public.is_admin()
    );

CREATE POLICY "product_images_admin_all"
    ON product_images FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- PRODUCT_DETAILS — lectura pública si producto visible; admin escribe
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "product_details_public_read"
    ON product_details FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM products p
            WHERE p.id = product_details.product_id
              AND p.is_visible = TRUE
              AND p.deleted_at IS NULL
        )
        OR public.is_admin()
    );

CREATE POLICY "product_details_admin_all"
    ON product_details FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- PRODUCT_TAG_ASSIGNMENTS — lectura pública; admin escribe
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "product_tag_assignments_public_read"
    ON product_tag_assignments FOR SELECT
    TO anon, authenticated
    USING (TRUE);

CREATE POLICY "product_tag_assignments_admin_all"
    ON product_tag_assignments FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- RELATED_PRODUCTS — lectura pública; admin escribe
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "related_products_public_read"
    ON related_products FOR SELECT
    TO anon, authenticated
    USING (TRUE);

CREATE POLICY "related_products_admin_all"
    ON related_products FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- ADDRESSES — solo el propietario o admin
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "addresses_owner_all"
    ON addresses FOR ALL
    TO authenticated
    USING (public.is_owner(user_id) OR public.is_admin())
    WITH CHECK (public.is_owner(user_id) OR public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- CARTS — solo el propietario o admin
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "carts_owner_all"
    ON carts FOR ALL
    TO authenticated
    USING (public.is_owner(user_id) OR public.is_admin())
    WITH CHECK (public.is_owner(user_id) OR public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- CART_ITEMS — acceso vía carrito del usuario
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "cart_items_owner_all"
    ON cart_items FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM carts c
            WHERE c.id = cart_items.cart_id
              AND (c.user_id = auth.uid() OR public.is_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM carts c
            WHERE c.id = cart_items.cart_id
              AND (c.user_id = auth.uid() OR public.is_admin())
        )
    );

-- ═════════════════════════════════════════════════════════════════════════════
-- WISHLIST_ITEMS — solo el propietario o admin
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "wishlist_items_owner_all"
    ON wishlist_items FOR ALL
    TO authenticated
    USING (public.is_owner(user_id) OR public.is_admin())
    WITH CHECK (public.is_owner(user_id) OR public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- COUPONS — clientes validan activos; admin gestiona
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "coupons_public_read_active"
    ON coupons FOR SELECT
    TO authenticated
    USING (
        (is_active = TRUE AND deleted_at IS NULL)
        OR public.is_admin()
    );

CREATE POLICY "coupons_admin_all"
    ON coupons FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- ORDERS — propietario ve los suyos; admin control total
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "orders_owner_select"
    ON orders FOR SELECT
    TO authenticated
    USING (public.is_owner(user_id) OR public.is_admin());

CREATE POLICY "orders_owner_insert"
    ON orders FOR INSERT
    TO authenticated
    WITH CHECK (public.is_owner(user_id) OR public.is_admin());

CREATE POLICY "orders_admin_update"
    ON orders FOR UPDATE
    TO authenticated
    USING (public.is_owner(user_id) OR public.is_admin())
    WITH CHECK (public.is_admin() OR public.is_owner(user_id));

CREATE POLICY "orders_admin_delete"
    ON orders FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- ORDER_ITEMS — acceso vía pedido del usuario
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "order_items_owner_select"
    ON order_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "order_items_owner_insert"
    ON order_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "order_items_admin_all"
    ON order_items FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- ORDER_STATUS_HISTORY — lectura vía pedido; escritura admin/sistema
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "order_status_history_owner_select"
    ON order_status_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_status_history.order_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "order_status_history_admin_insert"
    ON order_status_history FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- PAYMENT_TRANSACTIONS — acceso vía pedido
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "payment_transactions_owner_select"
    ON payment_transactions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = payment_transactions.order_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "payment_transactions_admin_all"
    ON payment_transactions FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- COUPON_REDEMPTIONS — propietario ve las suyas; admin todo
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "coupon_redemptions_owner_select"
    ON coupon_redemptions FOR SELECT
    TO authenticated
    USING (public.is_owner(user_id) OR public.is_admin());

CREATE POLICY "coupon_redemptions_owner_insert"
    ON coupon_redemptions FOR INSERT
    TO authenticated
    WITH CHECK (public.is_owner(user_id) OR public.is_admin());

CREATE POLICY "coupon_redemptions_admin_all"
    ON coupon_redemptions FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- REVIEWS — lectura pública de aprobadas; usuario gestiona las propias
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "reviews_public_read_approved"
    ON reviews FOR SELECT
    TO anon, authenticated
    USING (is_approved = TRUE OR public.is_owner(user_id) OR public.is_admin());

CREATE POLICY "reviews_owner_insert"
    ON reviews FOR INSERT
    TO authenticated
    WITH CHECK (public.is_owner(user_id));

CREATE POLICY "reviews_owner_update"
    ON reviews FOR UPDATE
    TO authenticated
    USING (public.is_owner(user_id) OR public.is_admin())
    WITH CHECK (public.is_owner(user_id) OR public.is_admin());

CREATE POLICY "reviews_admin_delete"
    ON reviews FOR DELETE
    TO authenticated
    USING (public.is_owner(user_id) OR public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- INVENTORY_MOVEMENTS — solo admin
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "inventory_movements_admin_all"
    ON inventory_movements FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS — solo el destinatario o admin
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "notifications_owner_all"
    ON notifications FOR ALL
    TO authenticated
    USING (public.is_owner(user_id) OR public.is_admin())
    WITH CHECK (public.is_owner(user_id) OR public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTACT_MESSAGES — cualquiera inserta; admin lee/responde
-- ═════════════════════════════════════════════════════════════════════════════

CREATE POLICY "contact_messages_public_insert"
    ON contact_messages FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

CREATE POLICY "contact_messages_admin_select"
    ON contact_messages FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "contact_messages_admin_update"
    ON contact_messages FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "contact_messages_admin_delete"
    ON contact_messages FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- GRANTS — permisos base para roles de Supabase
-- ═════════════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
