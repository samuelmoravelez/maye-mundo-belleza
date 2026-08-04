// js/entries/entry-productos.js
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/productos.css';
import '../../css/auth.css';
import '../../css/wishlist-quickview.css';

import '../main.js';
import { iniciarCatalogo }   from '../pages/productos.js';
import { iniciarAuthModal }  from '../components/authModal.js';
import { inicializarAdmin }  from '../utils/authService.js';
// Importar refreshProductos para arrancar la carga de Supabase lo antes posible
import { refreshProductos }  from '../data/productos.data.js';

// ── Prefetch: iniciar la carga desde Supabase ANTES del DOMContentLoaded.
// Cuando iniciarCatalogo() llame a ensureProductosLoaded(), la promesa ya
// estará en vuelo (o resuelta), así que no hay doble fetch.
const _prefetchPromise = refreshProductos().catch(err =>
    console.warn('[entry-productos] prefetch falló, se reintentará en iniciarCatalogo():', err)
);

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
    iniciarAuthModal();
    iniciarCatalogo();
});
