// src/js/services/cartService.js
// Carrito híbrido: localStorage (invitado) + Supabase (autenticado)

import Storage from '../../../js/utils/storage.js';
import { STORAGE_KEYS } from '../../../js/utils/constants.js';
import { supabase } from './supabaseClient.js';
import { getSession, isLoggedIn } from './authService.js';

const CLAVE = STORAGE_KEYS.CARRITO;

function _localItems() {
    try {
        const items = Storage.obtener(CLAVE, []);
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

function _persistLocal(items) {
    Storage.guardar(CLAVE, items);
    _dispatch(items);
}

function _dispatch(items) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carrito-actualizado', { detail: { items } }));
    }
}

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
            id: prod?.id ?? row.product_id,
            nombre: prod?.name ?? 'Producto',
            precio: Number(prod?.price ?? 0),
            imagen: imgs[0]?.url ?? '',
            cantidad: row.quantity,
            _cartItemId: row.id,
        };
    });
}

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
            cart_id: cartId,
            product_id: id,
            quantity: cantidad,
        });
    }
}

export function obtenerItems() {
    if (!isLoggedIn()) return _localItems();
    return _remoteCache;
}

/** Caché sincronizada para lecturas síncronas cuando hay sesión */
let _remoteCache = [];

export async function syncCartFromRemote() {
    const session = getSession();
    if (!session?.id) {
        _remoteCache = _localItems();
        return _remoteCache;
    }
    _remoteCache = await _fetchRemoteItems(session.id);
    _dispatch(_remoteCache);
    return _remoteCache;
}

export async function agregarItem({ id, nombre, precio, imagen }) {
    if (!isLoggedIn()) {
        const items = _localItems();
        const idx = items.findIndex(i => i.id === id);
        if (idx !== -1) items[idx].cantidad += 1;
        else items.push({ id, nombre, precio, imagen, cantidad: 1 });
        _persistLocal(items);
        return;
    }

    const session = getSession();
    const items = await _fetchRemoteItems(session.id);
    const idx = items.findIndex(i => String(i.id) === String(id));
    const cantidad = idx !== -1 ? items[idx].cantidad + 1 : 1;
    await _upsertRemoteItem(session.id, { id, cantidad });
    await syncCartFromRemote();
}

export async function eliminarItem(id) {
    if (!isLoggedIn()) {
        _persistLocal(_localItems().filter(i => i.id !== id));
        return;
    }
    const session = getSession();
    await _upsertRemoteItem(session.id, { id, cantidad: 0 });
    await syncCartFromRemote();
}

export async function cambiarCantidad(id, cantidad) {
    if (!isLoggedIn()) {
        const items = _localItems();
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return;
        if (cantidad <= 0) items.splice(idx, 1);
        else items[idx].cantidad = cantidad;
        _persistLocal(items);
        return;
    }
    const session = getSession();
    await _upsertRemoteItem(session.id, { id, cantidad });
    await syncCartFromRemote();
}

export async function vaciarCarrito() {
    if (!isLoggedIn()) {
        _persistLocal([]);
        return;
    }
    const session = getSession();
    const cartId = await _getOrCreateCartId(session.id);
    if (cartId) {
        await supabase.from('cart_items').delete().eq('cart_id', cartId);
    }
    _remoteCache = [];
    _dispatch([]);
}

export function contarItems() {
    return obtenerItems().reduce((acc, i) => acc + i.cantidad, 0);
}

export function calcularTotal() {
    return obtenerItems().reduce((acc, i) => acc + i.precio * i.cantidad, 0);
}

/**
 * Fusiona el carrito local en Supabase tras iniciar sesión.
 * @param {string} userId
 */
export async function mergeGuestCartOnLogin(userId) {
    const local = _localItems();
    if (!local.length) {
        await syncCartFromRemote();
        return;
    }

    const remote = await _fetchRemoteItems(userId);
    for (const item of local) {
        const rem = remote.find(r => String(r.id) === String(item.id));
        const qty = (rem?.cantidad ?? 0) + item.cantidad;
        await _upsertRemoteItem(userId, { id: item.id, cantidad: qty });
    }

    Storage.eliminar(CLAVE);
    await syncCartFromRemote();
}
