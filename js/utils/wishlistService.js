// js/utils/wishlistService.js
// ─────────────────────────────────────────────────────────────────────────────
// Servicio de Lista de Deseos (Wishlist) — Maye Mundo Belleza
//
// Persiste en localStorage bajo STORAGE_KEYS.FAVORITES ('maye_favorites').
// Valor: array de IDs numéricos de productos.
//
// Arquitectura: sin UI, sin DOM. Solo datos + eventos.
// Cualquier componente escucha el evento 'wishlist-actualizada' para refrescar.
// ─────────────────────────────────────────────────────────────────────────────

import Storage from './storage.js';
import { STORAGE_KEYS } from './constants.js';
import { getSession } from './authService.js';

const KEY = STORAGE_KEYS.FAVORITES; // 'maye_favorites'

// ── Helpers internos ──────────────────────────────────────────────────────────
function _get() {
    const raw = Storage.obtener(KEY, []);
    return Array.isArray(raw) ? raw.map(Number) : [];
}

function _save(ids) {
    Storage.guardar(KEY, ids);
    window.dispatchEvent(new CustomEvent('wishlist-actualizada', { detail: { ids } }));
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Devuelve los IDs de la lista de deseos actual.
 * @returns {number[]}
 */
export function obtenerFavoritos() {
    return _get();
}

/**
 * Indica si un producto está en la wishlist.
 * @param {number} productId
 * @returns {boolean}
 */
export function esFavorito(productId) {
    return _get().includes(Number(productId));
}

/**
 * Agrega o elimina un producto de la wishlist (toggle).
 * Requiere sesión activa; si no hay sesión, devuelve { ok:false, requiereLogin:true }.
 *
 * @param {number} productId
 * @returns {{ ok:boolean, accion:'agregado'|'eliminado'|null, requiereLogin?:boolean }}
 */
export function toggleFavorito(productId) {
    const session = getSession();
    if (!session) {
        return { ok: false, requiereLogin: true };
    }

    const id  = Number(productId);
    const ids = _get();
    const idx = ids.indexOf(id);

    if (idx === -1) {
        _save([...ids, id]);
        return { ok: true, accion: 'agregado' };
    } else {
        _save(ids.filter(x => x !== id));
        return { ok: true, accion: 'eliminado' };
    }
}

/**
 * Elimina un producto de la wishlist (sin toggle).
 * @param {number} productId
 */
export function eliminarFavorito(productId) {
    _save(_get().filter(x => x !== Number(productId)));
}

/**
 * Vacía la wishlist por completo.
 */
export function vaciarFavoritos() {
    _save([]);
}
