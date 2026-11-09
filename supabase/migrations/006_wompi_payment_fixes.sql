-- =============================================================================
-- Maye Mundo Belleza — Migración 006: Alineación pasarela Wompi
--
-- Corrige:
--   1. ENUM payment_method — valores en minúsculas usados por el frontend
--   2. RLS payment_transactions — INSERT permitido al dueño de la orden
--   3. (Opcional) Comentario de referencia sobre raw_response vs gateway_payload
--
-- Nota: orders.payment_status usa pending | paid | failed | refunded
--       payment_transactions.status usa pending | approved | declined | refunded
-- =============================================================================

-- ── 1. Extender ENUM payment_method con valores del frontend ─────────────────
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'nequi';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'bancolombia';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'contraentrega';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'wompi';

-- ── 2. RLS: dueño de la orden puede INSERTAR su transacción de pago ──────────
--    (El SELECT ya existe en migración 003; solo faltaba INSERT para clientes.)
CREATE POLICY "payment_transactions_owner_insert"
    ON payment_transactions FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = payment_transactions.order_id
              AND o.user_id = auth.uid()
        )
    );

COMMENT ON POLICY "payment_transactions_owner_insert" ON payment_transactions IS
    'Permite al cliente autenticado registrar la transacción Wompi de su propia orden.';
