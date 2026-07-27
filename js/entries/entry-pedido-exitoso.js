// js/entries/entry-pedido-exitoso.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point de la pantalla de pedido exitoso.
//
// Guard mínimo: si no hay sesión ni orden en sessionStorage,
// redirige a la tienda para evitar acceso directo sin contexto.
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/checkout.css';

import { getSession, inicializarAdmin } from '../utils/authService.js';
import { RUTAS }                        from '../utils/constants.js';
import { iniciarPedidoExitoso }         from '../pages/pedidoExitoso.js';

(function guardRuta() {
    inicializarAdmin();
    const session  = getSession();
    const orderId  = sessionStorage.getItem('maye_ultima_orden');

    // Sin sesión Y sin orden → redirigir
    if (!session && !orderId) {
        window.location.replace(RUTAS.HOME);
        throw new Error('[PedidoExitoso] Sin contexto de compra.');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    iniciarPedidoExitoso();
});
