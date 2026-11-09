// js/entries/entry-register.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point de la página independiente register.html (Split-Screen).
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/login.css';
import '../../css/register.css';

import { getSession, inicializarAdmin, ROLES } from '../utils/authService.js';
import { RUTAS }                                from '../utils/constants.js';
import { iniciarRegister }                      from '../pages/register.js';

// ── Auth Guard: Redirigir si ya cuenta con sesión iniciada ───────────────────
(function verificarSesionPrevia() {
    inicializarAdmin();
    const sesion = getSession();

    if (sesion && sesion.id) {
        const redirectPendiente = sessionStorage.getItem('maye_auth_redirect');
        if (redirectPendiente === 'checkout') {
            sessionStorage.removeItem('maye_auth_redirect');
            window.location.replace(RUTAS.CHECKOUT);
            return;
        }

        if (sesion.role === ROLES.ADMIN) {
            window.location.replace(RUTAS.DASHBOARD);
            return;
        }

        window.location.replace(RUTAS.DASHBOARD);
    }
})();

// ── Inicializar componentes cuando el DOM esté listo ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    iniciarRegister();
});
