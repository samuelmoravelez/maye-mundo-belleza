// js/entries/entry-carrito.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point de la página dedicada carrito.html (Mercado Libre Style)
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/auth.css';

import '../main.js';
import { iniciarAuthModal } from '../components/authModal.js';
import { inicializarAdmin } from '../utils/authService.js';
import { iniciarCarrito }   from '../pages/carrito.js';

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
    iniciarAuthModal();
    iniciarCarrito().catch(err => {
        console.error('[entry-carrito] Error no capturado en iniciarCarrito:', err);
        // Forzar la eliminación del skeleton en último recurso
        const skeleton = document.getElementById('carrito-loading');
        if (skeleton) {
            skeleton.hidden = true;
            skeleton.style.display = 'none';
        }
        const vacio = document.getElementById('carrito-vacio-full');
        if (vacio) {
            vacio.hidden = false;
            vacio.style.display = '';
        }
    });
});
