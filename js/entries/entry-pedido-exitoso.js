// js/entries/entry-pedido-exitoso.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point de la pantalla de confirmación de pedido.
//
// RESOLUCIÓN DE orderId (en orden de prioridad):
//   1. URL param ?orderId=UUID   ← enlace directo / email
//   2. sessionStorage 'maye_ultima_orden'   ← flujo normal post-checkout
//
// GUARD DE RUTA:
//   Si ninguna fuente produce un ID válido, redirige a index.html.
//
// NOTA: ya NO se verifica la orden en localStorage porque las órdenes
// viven en Supabase. La verificación real la hace obtenerOrdenPorId()
// dentro de iniciarPedidoExitoso(). El guard aquí solo comprueba que
// haya un ID presente (no vacío).
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/checkout.css';

import { inicializarAdmin }       from '../utils/authService.js';
import { RUTAS }                  from '../utils/constants.js';
import { iniciarPedidoExitoso }   from '../pages/pedidoExitoso.js';

// ── Auth seed (garantiza que el admin por defecto exista) ─────────────────
inicializarAdmin();

// ── Resolver orderId ──────────────────────────────────────────────────────
function _resolverOrderId() {
    // 1. URL param (soporta enlaces directos desde email / dashboard)
    const params = new URLSearchParams(window.location.search);
    const fromURL = params.get('orderId')?.trim();
    if (fromURL) return fromURL;

    // 2. sessionStorage (flujo normal desde checkout.html)
    const fromSession = sessionStorage.getItem('maye_ultima_orden')?.trim();
    if (fromSession) return fromSession;

    return null;
}

// ── Guard síncrono (antes del DOMContentLoaded) ───────────────────────────
;(function guardRuta() {
    const orderId = _resolverOrderId();

    if (!orderId) {
        // Sin ID → volver al inicio
        window.location.replace(RUTAS.HOME);
        throw new Error('[Confirmación] Sin orderId. Redirigiendo.');
    }

    // Asegurar que sessionStorage tenga el ID (por si llegó por URL param)
    sessionStorage.setItem('maye_ultima_orden', orderId);
})();

// ── Inicializar cuando el DOM esté listo ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    iniciarPedidoExitoso();
});
