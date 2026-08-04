// src/js/services/wishlistService.js

import Storage from '../../../js/utils/storage.js';
import { STORAGE_KEYS } from '../../../js/utils/constants.js';
import { supabase } from './supabaseClient.js';
import { getSession, isLoggedIn } from './authService.js';

const KEY = STORAGE_KEYS.FAVORITES;

function _getLocal() {
    const raw = Storage.obtener(KEY, []);
    return Array.isArray(raw) ? raw.map(Number) : [];
}

function _saveLocal(ids) {
    Storage.guardar(KEY, ids);
    _dispatch(ids);
}

function _dispatch(ids) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wishlist-actualizada', { detail: { ids } }));
    }
}

let _remoteIds = [];

export async function syncWishlistFromRemote() {
    const session = getSession();
    if (!session?.id) {
        _remoteIds = _getLocal();
        return _remoteIds;
    }

    const { data, error } = await supabase
        .from('wishlist_items')
        .select('product_id')
        .eq('user_id', session.id);

    if (error) {
        console.error('[wishlistService]', error.message);
        return _remoteIds;
    }

    _remoteIds = (data ?? []).map(r => Number(r.product_id));
    _dispatch(_remoteIds);
    return _remoteIds;
}

export function obtenerFavoritos() {
    if (!isLoggedIn()) return _getLocal();
    return [..._remoteIds];
}

export function esFavorito(productId) {
    return obtenerFavoritos().includes(Number(productId));
}

export async function toggleFavorito(productId) {
    const session = getSession();
    if (!session) {
        return { ok: false, requiereLogin: true };
    }

    const id = Number(productId);

    if (!isLoggedIn()) {
        const ids = _getLocal();
        const idx = ids.indexOf(id);
        if (idx === -1) {
            _saveLocal([...ids, id]);
            return { ok: true, accion: 'agregado' };
        }
        _saveLocal(ids.filter(x => x !== id));
        return { ok: true, accion: 'eliminado' };
    }

    const exists = _remoteIds.includes(id);
    if (!exists) {
        const { error } = await supabase.from('wishlist_items').insert({
            user_id: session.id,
            product_id: id,
        });
        if (error) return { ok: false, error: error.message };
        _remoteIds = [..._remoteIds, id];
        _dispatch(_remoteIds);
        return { ok: true, accion: 'agregado' };
    }

    const { error } = await supabase.from('wishlist_items')
        .delete()
        .eq('user_id', session.id)
        .eq('product_id', id);
    if (error) return { ok: false, error: error.message };
    _remoteIds = _remoteIds.filter(x => x !== id);
    _dispatch(_remoteIds);
    return { ok: true, accion: 'eliminado' };
}

export async function eliminarFavorito(productId) {
    const id = Number(productId);
    if (!isLoggedIn()) {
        _saveLocal(_getLocal().filter(x => x !== id));
        return;
    }
    const session = getSession();
    await supabase.from('wishlist_items')
        .delete()
        .eq('user_id', session.id)
        .eq('product_id', id);
    _remoteIds = _remoteIds.filter(x => x !== id);
    _dispatch(_remoteIds);
}

export async function vaciarFavoritos() {
    const session = getSession();
    if (!session) {
        _saveLocal([]);
        return;
    }
    await supabase.from('wishlist_items').delete().eq('user_id', session.id);
    _remoteIds = [];
    _dispatch([]);
}

/**
 * Tras login: fusiona favoritos locales con Supabase.
 * @param {string} userId
 */
export async function mergeGuestWishlistOnLogin(userId) {
    const local = _getLocal();
    if (!local.length) {
        await syncWishlistFromRemote();
        return;
    }
    for (const productId of local) {
        await supabase.from('wishlist_items').upsert(
            { user_id: userId, product_id: productId },
            { onConflict: 'user_id,product_id', ignoreDuplicates: true }
        );
    }
    Storage.eliminar(KEY);
    await syncWishlistFromRemote();
}
