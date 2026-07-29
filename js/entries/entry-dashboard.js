// js/entries/entry-dashboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point del Dashboard unificado.
//
// GUARD DE RUTA (IIFE síncrono):
//   Se ejecuta ANTES del DOMContentLoaded para evitar cualquier flash de
//   contenido. Si no hay sesión activa, redirige a index.html inmediatamente
//   y abre el modal de login mediante el flag sessionStorage.
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/dashboard.css';
import '../../css/wishlist-quickview.css';

import { getSession, inicializarAdmin } from '../utils/authService.js';
import { RUTAS } from '../utils/constants.js';
import { iniciarDashboard } from '../pages/dashboard.js';

// ── Auth Guard — corre inmediatamente (antes del DOM) ─────────────────────
(function guardRuta() {
    // Aseguramos que el admin por defecto esté creado antes de validar sesión
    inicializarAdmin();

    const session = getSession();

    if (!session) {
        // Sin sesión → redirigir a inicio y pedir login
        sessionStorage.setItem('maye_auth_redirect', 'dashboard');
        window.location.replace(RUTAS.HOME);
        // Detener ejecución del módulo completo
        throw new Error('[Dashboard] Redirigiendo: sin sesión activa.');
    }
})();

// ── Inicializar cuando el DOM esté listo ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    iniciarDashboard();
});
