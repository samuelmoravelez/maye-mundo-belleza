// src/js/services/bootstrap.js
// Inicialización compartida de servicios Supabase

import { inicializarAdmin, refreshUsersCache, isAdmin } from './authService.js';
import { refreshProductos } from './productService.js';
import { syncCartFromRemote } from './cartService.js';
import { syncWishlistFromRemote } from './wishlistService.js';
import { refreshCuponesCache } from './couponService.js';

/**
 * Restaura auth, catálogo y datos del usuario autenticado.
 */
export async function bootstrapApp() {
    await inicializarAdmin();
    await refreshProductos();

    const tasks = [syncCartFromRemote(), syncWishlistFromRemote()];
    if (isAdmin()) {
        tasks.push(refreshUsersCache(), refreshCuponesCache());
    }
    await Promise.all(tasks);
}
