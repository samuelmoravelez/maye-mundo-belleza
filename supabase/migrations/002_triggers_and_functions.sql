-- =============================================================================
-- Maye Mundo Belleza — Migración 002: Triggers y funciones
-- PostgreSQL / Supabase
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN: actualizar columna updated_at automáticamente
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at IS
    'Trigger function genérica para mantener updated_at sincronizado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS updated_at — tablas con columna updated_at
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_addresses_updated_at
    BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_carts_updated_at
    BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN: crear perfil automáticamente al registrarse en Supabase Auth
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT;
BEGIN
    -- Nombre desde metadata de registro o parte local del email
    v_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, name, phone, role, status)
    VALUES (
        NEW.id,
        v_name,
        NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), ''),
        CASE
            WHEN NEW.raw_user_meta_data ->> 'role' = 'admin'
                THEN 'admin'::user_role
            ELSE 'cliente'::user_role
        END,
        'active'::user_status
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
    'Crea una fila en profiles cuando un usuario se registra vía Supabase Auth.';

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: on_auth_user_created
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN: crear carrito vacío al crear perfil (opcional, mejora UX)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.carts (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN: mantener search_vector en products para búsqueda full-text
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.products_search_vector_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('spanish', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.brand, '')), 'C') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.sku, '')), 'D');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_search_vector
    BEFORE INSERT OR UPDATE OF name, description, brand, sku ON products
    FOR EACH ROW EXECUTE FUNCTION public.products_search_vector_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCIÓN: registrar historial al cambiar estado de un pedido
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.order_status_history (order_id, from_status, to_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_status_history
    AFTER UPDATE OF status ON orders
    FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();
