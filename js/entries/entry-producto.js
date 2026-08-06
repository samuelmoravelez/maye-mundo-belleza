// js/entries/entry-producto.js
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANTE: la causa del bug "Producto no encontrado" era una race condition:
//   1. DOMContentLoaded dispara iniciarDetalleProducto() de forma síncrona.
//   2. obtenerProductos() devuelve _cache que aún está vacío porque la promesa
//      de refreshProductos() / ensureProductosLoaded() todavía no ha resuelto.
//   3. productos.find() no halla nada → renderNoEncontrado().
//
// Solución: lanzar ensureProductosLoaded() lo antes posible (top-level, antes
// del DOMContentLoaded) y luego esperar su resolución dentro del handler antes
// de llamar a iniciarDetalleProducto(). Así el caché siempre está poblado
// cuando el render ocurre.
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/producto.css';
import '../../css/auth.css';
import '../../css/wishlist-quickview.css';

import '../main.js';
import { iniciarDetalleProducto } from '../pages/producto.js';
import { iniciarAuthModal }       from '../components/authModal.js';
import { inicializarAdmin }       from '../utils/authService.js';
// Importar ensureProductosLoaded para comenzar la carga inmediatamente,
// en paralelo con el resto de la inicialización del módulo.
import { ensureProductosLoaded }  from '../data/productos.data.js';

// ── Dispara la carga de Supabase ahora, sin esperar al DOM ────────────────────
const _productosListos = ensureProductosLoaded().catch(err => {
    console.warn('[entry-producto] prefetch falló, se reintentará en iniciarDetalleProducto():', err);
});

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar auth y modal en paralelo con la espera de productos
    inicializarAdmin();
    iniciarAuthModal();

    // Esperar a que el catálogo esté en caché ANTES de intentar renderizar
    await _productosListos;

    // En este punto obtenerProductos() devuelve los datos reales de Supabase
    iniciarDetalleProducto();
});
