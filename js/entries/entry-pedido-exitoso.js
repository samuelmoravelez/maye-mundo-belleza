// js/entries/entry-pedido-exitoso.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point de la pantalla de confirmación de pedido.
//
// RESOLUCIÓN DE orderId (en orden de prioridad):
//   1. URL param ?orderId=UUID
//   2. sessionStorage PAYMENT_SESSION_KEYS.ULTIMA_ORDEN
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/checkout.css';

import { inicializarAdmin }       from '../utils/authService.js';
import { RUTAS, PAYMENT_SESSION_KEYS } from '../utils/constants.js';
import { iniciarPedidoExitoso }   from '../pages/pedidoExitoso.js';

inicializarAdmin();

function _resolverOrderId() {
    const params    = new URLSearchParams(window.location.search);
    const fromURL   = params.get('orderId')?.trim();
    if (fromURL) return fromURL;

    const fromSession = sessionStorage.getItem(PAYMENT_SESSION_KEYS.ULTIMA_ORDEN)?.trim();
    if (fromSession) return fromSession;

    return null;
}

;(function guardRuta() {
    const orderId = _resolverOrderId();

    if (!orderId) {
        window.location.replace(RUTAS.HOME);
        throw new Error('[Confirmación] Sin orderId. Redirigiendo.');
    }

    sessionStorage.setItem(PAYMENT_SESSION_KEYS.ULTIMA_ORDEN, orderId);
})();

document.addEventListener('DOMContentLoaded', async () => {
    await iniciarPedidoExitoso();
});
