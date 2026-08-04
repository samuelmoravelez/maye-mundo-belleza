-- =============================================================================
-- Maye Mundo Belleza — Migración 005: email en profiles + descuento de stock
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Sincronizar email desde auth.users en filas existentes
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT;
BEGIN
    v_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, name, phone, email, role, status)
    VALUES (
        NEW.id,
        v_name,
        NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), ''),
        NEW.email,
        CASE
            WHEN NEW.raw_user_meta_data ->> 'role' = 'admin'
                THEN 'admin'::user_role
            ELSE 'cliente'::user_role
        END,
        'active'::user_status
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name  = COALESCE(NULLIF(EXCLUDED.name, ''), profiles.name);

    RETURN NEW;
END;
$$;

-- Descuenta stock tras crear ítems de pedido (clientes autenticados)
CREATE OR REPLACE FUNCTION public.apply_order_stock_deduction(p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item RECORD;
    v_product_id BIGINT;
    v_qty INTEGER;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RETURN;
    END IF;

    FOR item IN
        SELECT *
        FROM jsonb_to_recordset(p_items) AS x(
            product_id BIGINT,
            quantity INTEGER
        )
    LOOP
        v_product_id := item.product_id;
        v_qty := GREATEST(item.quantity, 0);
        IF v_product_id IS NULL OR v_qty <= 0 THEN
            CONTINUE;
        END IF;

        UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - v_qty),
            updated_at = NOW()
        WHERE id = v_product_id AND deleted_at IS NULL;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.apply_order_stock_deduction IS
    'Resta stock_quantity según ítems del pedido (JSON: [{ product_id, quantity }]).';

GRANT EXECUTE ON FUNCTION public.apply_order_stock_deduction(JSONB) TO authenticated;
