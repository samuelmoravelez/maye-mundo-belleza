// js/entries/entry-checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point del Checkout.
//
// AUTH GUARD (IIFE síncrono):
//   El checkout requiere sesión activa. Sin sesión → redirige a index.html
//   con el flag que abre el modal de login automáticamente.
//   Clientes inactivos tampoco pueden acceder.
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/checkout.css';

import { getSession, inicializarAdmin, STATUS } from '../utils/authService.js';
import { RUTAS }                                from '../utils/constants.js';
import { iniciarCheckout }                      from '../pages/checkout.js';

// ── Auth Guard ────────────────────────────────────────────────────────────────
(function guardRuta() {
    inicializarAdmin();
    const session = getSession();

    if (!session) {
        sessionStorage.setItem('maye_auth_redirect', 'checkout');
        window.location.replace(RUTAS.HOME);
        throw new Error('[Checkout] Redirigiendo: sin sesión activa.');
    }

    // Bloquear cuentas inactivas
    if ((session.status ?? STATUS.ACTIVE) === STATUS.INACTIVE) {
        sessionStorage.setItem('maye_auth_redirect', 'checkout');
        window.location.replace(RUTAS.HOME);
        throw new Error('[Checkout] Cuenta inactiva.');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    iniciarCheckout();
});
