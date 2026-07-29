// js/entries/entry-index.js
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/index.css';
import '../../css/auth.css';
import '../../css/wishlist-quickview.css';

import '../main.js';
import { iniciarBotonesCarrito } from '../pages/index.js';
import { iniciarFAQ } from '../pages/faq.js';
import { iniciarAuthModal, abrirModal } from '../components/authModal.js';
import { inicializarAdmin } from '../utils/authService.js';

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin(); // ← siempre primero: garantiza que el admin exista antes de montar la UI
    iniciarAuthModal();

    // Si viene redirigido desde admin.html (sin sesión), abrir modal de login
    const authRedirect = sessionStorage.getItem('maye_auth_redirect');
    if (authRedirect === 'admin' || authRedirect === 'dashboard' || authRedirect === 'checkout') {
        sessionStorage.removeItem('maye_auth_redirect');
        setTimeout(() => abrirModal('login'), 120);
    }

    iniciarBotonesCarrito();
    iniciarFAQ();
});
