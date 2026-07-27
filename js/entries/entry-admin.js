// js/entries/entry-admin.js
// admin.html ahora es un alias de compatibilidad.
// Si hay sesión de admin activa → redirige al dashboard unificado.
// Si no hay sesión → redirige a home con el flag de login.

import { isAdmin, getSession, inicializarAdmin } from '../utils/authService.js';
import { RUTAS } from '../utils/constants.js';

(function guardRuta() {
    inicializarAdmin();
    const session = getSession();

    if (!session) {
        sessionStorage.setItem('maye_auth_redirect', 'admin');
        window.location.replace(RUTAS.HOME);
        return;
    }

    // Cualquier usuario autenticado (admin o cliente) va al dashboard
    window.location.replace(RUTAS.DASHBOARD);
})();
