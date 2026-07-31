// js/entries/entry-pedido-exitoso.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point de la pantalla de confirmación de pedido.
//
// RESOLUCIÓN DE orderId (en orden de prioridad):
//   1. URL param ?orderId=ORD-0001-12345   ← enlace directo / email
//   2. sessionStorage 'maye_ultima_orden'   ← flujo normal post-checkout
//
// GUARD DE RUTA:
//   Si ninguna fuente produce un ID válido, redirige a index.html.
//   Si el ID no existe en maye_orders, también redirige.
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/checkout.css';

import { inicializarAdmin }       from '../utils/authService.js';
import { RUTAS, STORAGE_KEYS }    from '../utils/constants.js';
import Storage                    from '../utils/storage.js';
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
        // Sin ID → volver al inicio y abrir el modal de login
        sessionStorage.setItem('maye_auth_redirect', 'checkout');
        window.location.replace(RUTAS.HOME);
        throw new Error('[Confirmación] Sin orderId. Redirigiendo.');
    }

    // Verificar que la orden exista en maye_orders
    const orders = Storage.obtener(STORAGE_KEYS.ORDERS, []);
    const existe = orders.some(o => o.id === orderId);

    if (!existe) {
        // ID inválido o manipulado → redirigir a inicio
        console.warn(`[Confirmación] Orden "${orderId}" no encontrada en maye_orders.`);
        window.location.replace(RUTAS.HOME);
        throw new Error('[Confirmación] Orden no encontrada. Redirigiendo.');
    }

    // Asegurar que sessionStorage tenga el ID (por si llegó por URL param)
    sessionStorage.setItem('maye_ultima_orden', orderId);
})();

// ── Inicializar cuando el DOM esté listo ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    iniciarPedidoExitoso();
});
