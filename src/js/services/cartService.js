// src/js/services/cartService.js
// Carrito 100 % Supabase — fuente única de verdad.
// Usuario no autenticado: contador 0, sin escritura local.

import { supabase } from './supabaseClient.js';
import { getSession, isLoggedIn } from './authService.js';

// ── Dispatch de eventos ────────────────────────────────────────────────────
function _dispatch(items) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carrito-actualizado', { detail: { items } }));
        window.dispatchEvent(new CustomEvent('cart:updated',        { detail: { items } }));
    }
}

// ── Obtener o crear el cart_id del usuario en Supabase ────────────────────
async function _getOrCreateCartId(userId) {
    const { data: cart, error } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('[cartService] cart:', error.message);
        return null;
    }
    if (cart?.id) return cart.id;

    const { data: created, error: insErr } = await supabase
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();

    if (insErr) {
        console.error('[cartService] create cart:', insErr.message);
        return null;
    }
    return created.id;
}

// ── Traer ítems del carrito desde Supabase ─────────────────────────────────
async function _fetchRemoteItems(userId) {
    const cartId = await _getOrCreateCartId(userId);
    if (!cartId) return [];

    const { data, error } = await supabase
        .from('cart_items')
        .select(`
            id, quantity, product_id,
            products (
                id, name, price,
                product_images ( url, sort_order )
            )
        `)
        .eq('cart_id', cartId);

    if (error) {
        console.error('[cartService] cart_items:', error.message);
        return [];
    }

    return (data ?? []).map(row => {
        const prod = row.products;
        const imgs = (prod?.product_images ?? []).slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        return {
            id:          prod?.id ?? row.product_id,
            nombre:      prod?.name ?? 'Producto',
            precio:      Number(prod?.price ?? 0),
            imagen:      imgs[0]?.url ?? '',
            cantidad:    row.quantity,
            _cartItemId: row.id,
        };
    });
}

// ── Upsert / delete de un ítem en Supabase ─────────────────────────────────
async function _upsertRemoteItem(userId, { id, cantidad }) {
    const cartId = await _getOrCreateCartId(userId);
    if (!cartId) return;

    const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', id)
        .maybeSingle();

    if (cantidad <= 0) {
        if (existing?.id) {
            await supabase.from('cart_items').delete().eq('id', existing.id);
        }
        return;
    }

    if (existing?.id) {
        await supabase.from('cart_items')
            .update({ quantity: cantidad })
            .eq('id', existing.id);
    } else {
        await supabase.from('cart_items').insert({
            cart_id:    cartId,
            product_id: id,
            quantity:   cantidad,
        });
    }
}

// ── Caché en memoria (se recarga con syncCartFromRemote) ───────────────────
let _remoteCache = [];

export function obtenerItems() {
    return _remoteCache;
}

/**
 * Sincroniza el caché en memoria con Supabase.
 * - Usuario autenticado  → consulta cart_items y dispara eventos.
 * - Usuario anónimo      → vacía el caché y dispara eventos con [].
 */
export async function syncCartFromRemote() {
    const session = getSession();
    if (!session?.id) {
        _remoteCache = [];
        _dispatch([]);
        return [];
    }
    _remoteCache = await _fetchRemoteItems(session.id);
    _dispatch(_remoteCache);
    return _remoteCache;
}

// ── Operaciones de escritura ───────────────────────────────────────────────

export async function agregarItem({ id, nombre, precio, imagen }) {
    if (!isLoggedIn()) return; // sin sesión: no hacer nada

    const session = getSession();
    const items   = await _fetchRemoteItems(session.id);
    const idx     = items.findIndex(i => String(i.id) === String(id));
    const cantidad = idx !== -1 ? items[idx].cantidad + 1 : 1;
    await _upsertRemoteItem(session.id, { id, cantidad });
    await syncCartFromRemote();
}

export async function eliminarItem(id) {
    if (!isLoggedIn()) return;
    const session = getSession();
    await _upsertRemoteItem(session.id, { id, cantidad: 0 });
    await syncCartFromRemote();
}

export async function cambiarCantidad(id, cantidad) {
    if (!isLoggedIn()) return;
    const session = getSession();
    await _upsertRemoteItem(session.id, { id, cantidad });
    await syncCartFromRemote();
}

export async function vaciarCarrito() {
    if (!isLoggedIn()) return;
    const session = getSession();
    const cartId  = await _getOrCreateCartId(session.id);
    if (cartId) {
        await supabase.from('cart_items').delete().eq('cart_id', cartId);
    }
    _remoteCache = [];
    _dispatch([]);
}

// ── Helpers de lectura ─────────────────────────────────────────────────────

export function contarItems() {
    return _remoteCache.reduce((acc, i) => acc + i.cantidad, 0);
}

export function calcularTotal() {
    return _remoteCache.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
}

/**
 * Tras iniciar sesión: cualquier dato local previo se descarta —
 * la fuente única es Supabase, así que solo se hace una sync normal.
 * El parámetro userId se conserva para compatibilidad con las llamadas
 * existentes en authService.js.
 * @param {string} userId
 */
export async function mergeGuestCartOnLogin(userId) {
    await syncCartFromRemote();
}
