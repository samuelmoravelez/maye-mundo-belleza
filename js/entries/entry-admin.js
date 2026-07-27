// js/entries/entry-admin.js
// Entry point exclusivo del panel de administración.
// Aplica protección de ruta ANTES de cargar el panel.

import '../../css/variables.css';
import '../../css/admin.css';

import { iniciarAdmin } from '../pages/admin.js';
import { isAdmin } from '../utils/authService.js';
import { RUTAS } from '../utils/constants.js';

// ── Protección de ruta sincrónica (antes del DOMContentLoaded) ───────────────
// Se ejecuta inmediatamente para evitar que el panel flashee antes de redirigir.
(function guardRuta() {
    if (!isAdmin()) {
        // Guardar la intención de ir al admin para que el modal abra directo
        sessionStorage.setItem('maye_auth_redirect', 'admin');
        window.location.replace(RUTAS.HOME);
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // Doble check por si el guard de arriba no alcanzó a redirigir
    if (!isAdmin()) return;
    iniciarAdmin();
});
