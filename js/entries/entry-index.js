// js/entries/entry-index.js
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/index.css';
import '../../css/auth.css';
import '../../css/wishlist-quickview.css';

import '../main.js';
import { iniciarBotonesCarrito } from '../pages/index.js';
import { iniciarFAQ }            from '../pages/faq.js';
import { iniciarAuthModal }            from '../components/authModal.js';
import { inicializarAdmin }      from '../utils/authService.js';
import { ensureProductosLoaded } from '../data/productos.data.js';

// Disparar la carga del catálogo a nivel de módulo — antes del DOM —
// para que la Promise esté en vuelo mientras el resto del JS se inicializa.
const _catalogoListo = ensureProductosLoaded().catch(err =>
    console.warn('[entry-index] prefetch del catálogo falló:', err)
);

document.addEventListener('DOMContentLoaded', async () => {
    inicializarAdmin();
    iniciarAuthModal();

    // Esperar el catálogo de Supabase ANTES de montar los botones.
    // Sin este await los botones se inyectan con los IDs del HTML estático
    // (1, 2, 3…) que NO son los IDs reales de la BD → fallo de FK en wishlist,
    // quickview vacío y el carrito llama a Supabase con IDs inexistentes.
    await _catalogoListo;

    iniciarBotonesCarrito();
    iniciarFAQ();
});
