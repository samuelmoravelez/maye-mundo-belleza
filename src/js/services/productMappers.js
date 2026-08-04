const DETAIL_TYPE_MAP = {
    benefit: 'beneficios',
    usage_step: 'modoUso',
    ingredient: 'ingredientes',
};

/**
 * Convierte una fila de Supabase (con relaciones) al shape del frontend.
 * @param {object} row
 * @returns {Producto}
 */
export function mapRowToProducto(row) {
    if (!row) return null;

    const images = (row.product_images ?? [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const mainImage = images[0]?.url ?? '';

    const details = row.product_details ?? [];
    const grouped = { beneficios: [], modoUso: [], ingredientes: [] };
    for (const d of details) {
        const key = DETAIL_TYPE_MAP[d.detail_type];
        if (key) grouped[key].push(d.content);
    }

    let etiqueta = null;
    const tags = row.product_tag_assignments ?? [];
    if (tags.length > 0) {
        const tag = tags[0]?.product_tags ?? tags[0];
        etiqueta = tag?.slug ?? null;
    }
    if ((row.stock_quantity ?? 0) === 0) {
        etiqueta = 'agotado';
    }

    const categoriaSlug = row.categories?.slug ?? row.category_slug ?? 'capilar';

    return {
        id: Number(row.id),
        slug: row.slug ?? '',
        nombre: row.name ?? '',
        categoria: categoriaSlug,
        precio: Number(row.price ?? 0),
        precioAnterior: row.compare_at_price != null ? Number(row.compare_at_price) : null,
        imagen: mainImage,
        imagenes: images.length ? images.map(i => i.url) : (mainImage ? [mainImage] : []),
        etiqueta,
        visible: row.is_visible !== false,
        stock: Number(row.stock_quantity ?? 0),
        descripcion: row.description ?? '',
        whatsapp: row.whatsapp_message ?? '',
        marca: row.brand ?? '',
        destacado: Boolean(row.is_featured),
        sku: row.sku ?? null,
        beneficios: grouped.beneficios,
        modoUso: grouped.modoUso,
        ingredientes: grouped.ingredientes,
        fechaCreacion: row.created_at ?? null,
        fechaModificacion: row.updated_at ?? null,
    };
}

export const PRODUCT_SELECT = `
    *,
    categories (*),
    product_images (*),
    product_details (*),
    product_tag_assignments ( product_tags (*) )
`;
