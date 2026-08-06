// js/entries/entry-404.js
// Página 404 — solo necesita el núcleo compartido (header, carrito, WhatsApp)
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/auth.css';

import '../main.js';
import { iniciarAuthModal } from '../components/authModal.js';
import { inicializarAdmin } from '../utils/authService.js';

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
    iniciarAuthModal();

    // Mostrar la ruta que no se encontró (si existe)
    const rutaEl = document.getElementById('not-found-path');
    if (rutaEl) {
        const ruta = decodeURIComponent(window.location.pathname);
        if (ruta && ruta !== '/404.html') {
            rutaEl.textContent = ruta;
            rutaEl.closest('.nf-ruta-wrap')?.removeAttribute('hidden');
        }
    }
});
