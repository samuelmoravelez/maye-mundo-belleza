-- =============================================================================
-- Maye Mundo Belleza — Migración 004: Datos semilla (seed)
-- PostgreSQL / Supabase
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- CATEGORÍAS — alineadas con js/data/productos.data.js
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO categories (slug, name, description, sort_order, is_active)
VALUES
    (
        'capilar',
        'Cuidado Capilar',
        'Tratamientos, shampoos, mascarillas y productos para el cuidado del cabello.',
        1,
        TRUE
    ),
    (
        'maquillaje',
        'Maquillaje',
        'Labiales, bases, sombras y accesorios de maquillaje profesional.',
        2,
        TRUE
    ),
    (
        'unas',
        'Uñas',
        'Esmaltes, tratamientos y productos para manicure y pedicure.',
        3,
        TRUE
    ),
    (
        'skincare',
        'Skincare',
        'Serums, cremas, limpiadores y rutinas de cuidado facial.',
        4,
        TRUE
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- ETIQUETAS DE PRODUCTO — alineadas con ETIQUETAS en productos.data.js
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO product_tags (slug, label)
VALUES
    ('nuevo',   'Nuevo'),
    ('popular', 'Más vendido'),
    ('oferta',  'Oferta'),
    ('agotado', 'Agotado');

-- ─────────────────────────────────────────────────────────────────────────────
-- CUPONES DE PRUEBA — alineados con couponService.js
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO coupons (
    code,
    type,
    value,
    min_purchase,
    max_uses,
    expires_at,
    is_active,
    description
)
VALUES
    (
        'MAYE10',
        'porcentaje',
        10,
        50000,
        100,
        NOW() + INTERVAL '6 months',
        TRUE,
        '10% de descuento en compras superiores a $50.000 COP.'
    ),
    (
        'BIENVENIDA',
        'porcentaje',
        15,
        30000,
        NULL,
        NOW() + INTERVAL '1 year',
        TRUE,
        '15% de bienvenida para nuevos clientes. Compra mínima $30.000 COP.'
    ),
    (
        'MAYE5000',
        'fijo',
        5000,
        80000,
        50,
        NOW() + INTERVAL '3 months',
        TRUE,
        '$5.000 COP de descuento fijo en compras superiores a $80.000 COP.'
    ),
    (
        'ENVIOGRATIS',
        'fijo',
        8000,
        100000,
        200,
        NULL,
        TRUE,
        'Descuento equivalente al costo de envío ($8.000) en compras mayores a $100.000 COP.'
    );

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTA: Los productos e imágenes se migrarán desde el frontend o un script
-- dedicado, ya que dependen de URLs de Cloudinary y datos del catálogo actual.
-- Ejemplo de inserción mínima para validar relaciones:
-- ─────────────────────────────────────────────────────────────────────────────

-- Descomentar para pruebas locales:
--
-- INSERT INTO products (
--     sku, slug, name, description, category_id, brand,
--     price, stock_quantity, is_visible, is_featured
-- )
-- SELECT
--     'MAYE-TRAT-CAP-001',
--     'tratamiento-hidratante-premium',
--     'Tratamiento Hidratante Premium',
--     'Tratamiento capilar de hidratación profunda.',
--     c.id,
--     'Maye Professional',
--     45000,
--     15,
--     TRUE,
--     TRUE
-- FROM categories c
-- WHERE c.slug = 'capilar';
