-- =============================================================================
-- Maye Mundo Belleza — Migración 007: Soporte Mercado Pago Checkout Pro
-- =============================================================================

-- ── 1. Extender ENUM payment_method con 'mercadopago' ─────────────────────────
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'mercadopago';

COMMENT ON TYPE payment_method IS
    'Métodos de pago admitidos: WhatsApp, Web_Simulado, Nequi, Bancolombia, contraentrega, wompi, mercadopago';
