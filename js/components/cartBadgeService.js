// js/components/cartBadgeService.js
// Responsabilidad: mantener sincronizado el badge/contador del carrito
// en el header de todas las páginas.
//
// — Consulta Supabase al cargar (via syncCartFromRemote).
// — Escucha 'carrito-actualizado' y 'cart:updated' para actualizaciones
//   en tiempo real sin recargar la página.
// — Si el usuario no está autenticado, muestra 0.

import { contarItems, syncCartFromRemote } from '../utils/carrito.js';

// ── Actualiza todos los elementos .contador-carrito del DOM ───────────────
function _actualizarBadge() {
    const total = contarItems();
    document.querySelectorAll('.contador-carrito').forEach(el => {
        el.textContent = total;
        if (total > 0) {
            el.classList.add('bump');
            setTimeout(() => el.classList.remove('bump'), 400);
        }
    });
}

// ── Inicialización ────────────────────────────────────────────────────────
export function iniciarCartBadge() {
    // Consulta Supabase al arrancar y actualiza el badge
    syncCartFromRemote().then(_actualizarBadge);

    // Reaccionar a cualquier cambio de carrito en tiempo real
    window.addEventListener('carrito-actualizado', _actualizarBadge);
    window.addEventListener('cart:updated',         _actualizarBadge);
}
