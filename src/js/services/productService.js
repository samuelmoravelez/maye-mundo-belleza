// src/js/services/productService.js
// Catálogo de productos — Supabase PostgreSQL

import { supabase } from './supabaseClient.js';
import { mapRowToProducto, PRODUCT_SELECT } from './productMappers.js';

/** @type {object[]} */
let _cache = [];
let _cacheLoaded = false;
/** @type {Promise<void>|null} */
let _loadPromise = null;

let _categorySlugToId = new Map();

function _emitActualizados() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('productos-actualizados', {
            detail: { productos: _cache },
        }));
    }
}

async function _loadCategoryMap() {
    const { data, error } = await supabase
        .from('categories')
        .select('id, slug');
    if (error) {
        console.error('[productService] categories:', error.message);
        return;
    }
    _categorySlugToId = new Map((data ?? []).map(c => [c.slug, c.id]));
}

async function _fetchAllRows() {
    const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .is('deleted_at', null)
        .order('id', { ascending: true });

    if (error) {
        console.error('[productService] products:', error.message);
        return [];
    }
    return (data ?? []).map(mapRowToProducto).filter(Boolean);
}

/**
 * Carga o recarga el catálogo desde Supabase.
 * @returns {Promise<object[]>}
 */
export async function refreshProductos() {
    _loadPromise = (async () => {
        await _loadCategoryMap();
        _cache = await _fetchAllRows();
        _cacheLoaded = true;
        _emitActualizados();
    })();
    await _loadPromise;
    return _cache;
}

/**
 * Garantiza que el catálogo esté cargado (idempotente).
 * @returns {Promise<object[]>}
 */
export async function ensureProductosLoaded() {
    if (_cacheLoaded) return _cache;
    if (_loadPromise) {
        await _loadPromise;
        return _cache;
    }
    return refreshProductos();
}

/** @returns {object[]} */
export function obtenerProductos() {
    return _cache.map(p => ({ ...p }));
}

export function isProductosLoaded() {
    return _cacheLoaded;
}

/**
 * @param {object[]} productos
 * @returns {Promise<object[]>}
 */
export async function guardarProductos(productos) {
    await ensureProductosLoaded();
    const saved = [];
    for (const p of productos) {
        const row = await _upsertProducto(p);
        if (row) saved.push(row);
    }
    await refreshProductos();
    return saved.length ? _cache : obtenerProductos();
}

async function _upsertProducto(p) {
    const categoryId = _categorySlugToId.get(p.categoria);
    if (!categoryId) {
        console.warn('[productService] Categoría desconocida:', p.categoria);
        return null;
    }

    const payload = {
        sku: p.sku ?? null,
        slug: p.slug || _slugify(p.nombre),
        name: p.nombre,
        description: p.descripcion ?? '',
        category_id: categoryId,
        brand: p.marca ?? null,
        price: p.precio,
        compare_at_price: p.precioAnterior ?? null,
        stock_quantity: p.stock ?? 0,
        is_visible: p.visible !== false,
        is_featured: Boolean(p.destacado),
        whatsapp_message: p.whatsapp ?? null,
    };

    let productId = p.id;

    if (productId) {
        const { error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', productId);
        if (error) {
            console.error('[productService] update:', error.message);
            return null;
        }
    } else {
        const { data, error } = await supabase
            .from('products')
            .insert(payload)
            .select('id')
            .single();
        if (error) {
            console.error('[productService] insert:', error.message);
            return null;
        }
        productId = data.id;
    }

    await _syncProductImages(productId, p);
    await _syncProductDetails(productId, p);
    await _syncProductTags(productId, p.etiqueta);

    return productId;
}

async function _syncProductImages(productId, p) {
    await supabase.from('product_images').delete().eq('product_id', productId);
    const urls = (p.imagenes?.length ? p.imagenes : (p.imagen ? [p.imagen] : []));
    if (!urls.length) return;

    const rows = urls.map((url, i) => ({
        product_id: productId,
        url,
        sort_order: i,
        alt_text: p.nombre ?? null,
    }));
    const { error } = await supabase.from('product_images').insert(rows);
    if (error) console.error('[productService] images:', error.message);
}

async function _syncProductDetails(productId, p) {
    await supabase.from('product_details').delete().eq('product_id', productId);
    const rows = [];
    const pushRows = (items, detail_type) => {
        (items ?? []).forEach((content, sort_order) => {
            if (String(content).trim()) {
                rows.push({ product_id: productId, detail_type, content, sort_order });
            }
        });
    };
    pushRows(p.beneficios, 'benefit');
    pushRows(p.modoUso, 'usage_step');
    pushRows(p.ingredientes, 'ingredient');
    if (!rows.length) return;
    const { error } = await supabase.from('product_details').insert(rows);
    if (error) console.error('[productService] details:', error.message);
}

async function _syncProductTags(productId, etiquetaSlug) {
    await supabase.from('product_tag_assignments').delete().eq('product_id', productId);
    if (!etiquetaSlug || etiquetaSlug === 'agotado') return;

    const { data: tag } = await supabase
        .from('product_tags')
        .select('id')
        .eq('slug', etiquetaSlug)
        .maybeSingle();
    if (!tag?.id) return;

    const { error } = await supabase.from('product_tag_assignments').insert({
        product_id: productId,
        tag_id: tag.id,
    });
    if (error) console.error('[productService] tags:', error.message);
}

function _slugify(text) {
    return String(text ?? 'producto')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || `producto-${Date.now()}`;
}

export function generarId(productos) {
    const list = productos?.length ? productos : _cache;
    return list.length > 0
        ? Math.max(...list.map(p => Number(p.id))) + 1
        : 1;
}

export async function obtenerProductoPorId(id) {
    await ensureProductosLoaded();
    const local = _cache.find(p => String(p.id) === String(id));
    if (local) return { ...local };

    const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('id', id)
        .maybeSingle();
    if (error || !data) return null;
    return mapRowToProducto(data);
}

export async function obtenerProductoPorSlug(slug) {
    await ensureProductosLoaded();
    const local = _cache.find(p => p.slug === slug);
    if (local) return { ...local };

    const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('slug', slug)
        .maybeSingle();
    if (error || !data) return null;
    return mapRowToProducto(data);
}

export function filtrarPorCategoria(categoriaId) {
    const list = obtenerProductos().filter(p => p.visible);
    if (!categoriaId || categoriaId === 'todos') return list;
    return list.filter(p => p.categoria === categoriaId);
}

export function buscarProductos(texto) {
    const q = String(texto ?? '').trim().toLowerCase();
    if (!q) return obtenerProductos().filter(p => p.visible);
    return obtenerProductos().filter(p => {
        if (!p.visible) return false;
        const hay = [
            p.nombre, p.descripcion, p.marca, p.sku, p.categoria,
        ].join(' ').toLowerCase();
        return hay.includes(q);
    });
}

export function obtenerDestacados() {
    return obtenerProductos().filter(p => p.visible && p.destacado);
}

export function obtenerOfertas() {
    return obtenerProductos().filter(p =>
        p.visible && p.precioAnterior != null && p.precioAnterior > p.precio
    );
}

/**
 * @param {{ page?: number, pageSize?: number, categoria?: string, q?: string }} opts
 */
export function paginarProductos(opts = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.max(1, opts.pageSize ?? 12);
    let list = obtenerProductos().filter(p => p.visible);
    if (opts.categoria && opts.categoria !== 'todos') {
        list = list.filter(p => p.categoria === opts.categoria);
    }
    if (opts.q) {
        const q = opts.q.trim().toLowerCase();
        list = list.filter(p =>
            [p.nombre, p.descripcion, p.marca].join(' ').toLowerCase().includes(q)
        );
    }
    const total = list.length;
    const start = (page - 1) * pageSize;
    return {
        items: list.slice(start, start + pageSize),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
    };
}

/**
 * Ajuste de inventario (admin / post-orden).
 * @param {number|string} productId
 * @param {number} delta — negativo descuenta
 */
export async function ajustarStock(productId, delta) {
    const prod = await obtenerProductoPorId(productId);
    if (!prod) return { ok: false, error: 'NOT_FOUND' };
    const nuevo = Math.max(0, (prod.stock ?? 0) + delta);
    const { error } = await supabase
        .from('products')
        .update({ stock_quantity: nuevo })
        .eq('id', productId);
    if (error) return { ok: false, error: error.message };
    await refreshProductos();
    return { ok: true, stock: nuevo };
}

export async function eliminarProducto(productId) {
    const { error } = await supabase
        .from('products')
        .update({ deleted_at: new Date().toISOString(), is_visible: false })
        .eq('id', productId);
    if (error) return { ok: false, error: error.message };
    await refreshProductos();
    return { ok: true };
}
