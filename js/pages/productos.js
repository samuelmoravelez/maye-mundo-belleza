// js/pages/productos.js
// Catálogo dinámico: lee productos desde Supabase vía productService.
// Maneja filtros por categoría, búsqueda, renderizado de tarjetas y carrito.

import { obtenerProductos, ensureProductosLoaded, formatearPrecio, ETIQUETAS } from '../data/productos.data.js';
import { agregarItem }                                   from '../utils/carrito.js';
import { toggleFavorito, esFavorito }                   from '../utils/wishlistService.js';
import { abrirQuickView, iniciarQuickView }              from '../components/quickView.js';
import { waLink }                                        from '../utils/constants.js';

// ── ESTADO ────────────────────────────────────────────────────────────────────
let productos       = [];
let categoriaActiva = 'todos';
let textoBusqueda   = '';

// ── ELEMENTOS DOM ─────────────────────────────────────────────────────────────
let grilla        = null;
let contadorTotal = null;
let inputBusqueda = null;

// ── INICIALIZACIÓN ────────────────────────────────────────────────────────────
export function iniciarCatalogo() {
    grilla        = document.getElementById('grilla-catalogo');
    contadorTotal = document.getElementById('contador-resultados');
    inputBusqueda = document.getElementById('busqueda-catalogo');

    if (!grilla) return;

    // Iniciar Quick View (inyecta el modal una sola vez)
    iniciarQuickView();

    inyectarToastContainer();
    cargarYRenderizar();

    // Filtros de categoría (pills + tarjetas de categoría)
    document.querySelectorAll('[data-categoria]').forEach(el => {
        el.addEventListener('click', () => {
            categoriaActiva = el.dataset.categoria;
            document.querySelectorAll('[data-categoria]').forEach(e => e.classList.remove('activo'));
            document.querySelectorAll(`[data-categoria="${categoriaActiva}"]`).forEach(e => e.classList.add('activo'));
            renderizar();
        });
    });

    // Buscador en tiempo real
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', () => {
            textoBusqueda = inputBusqueda.value.toLowerCase().trim();
            renderizar();
        });
    }

    // Delegación de eventos para botones "Agregar al carrito" generados dinámicamente
    grilla.addEventListener('click', (e) => {
        // ── Agregar al carrito ──────────────────────────────────────────
        const btnCarrito = e.target.closest('[data-btn-carrito]');
        if (btnCarrito) {
            const id     = Number(btnCarrito.dataset.id);
            const nombre = btnCarrito.dataset.nombre;
            const precio = Number(btnCarrito.dataset.precio);
            const imagen = btnCarrito.dataset.imagen;
            agregarItem({ id, nombre, precio, imagen });
            mostrarToastCatalogo(`${nombre} agregado al carrito`);
            feedbackBoton(btnCarrito);
            return;
        }

        // ── Wishlist (corazón) ──────────────────────────────────────────
        const btnWish = e.target.closest('[data-btn-wishlist]');
        if (btnWish) {
            // CRÍTICO: detener la burbuja para que el clic no active
            // el <a> padre ni el listener de vista rápida
            e.stopPropagation();
            e.preventDefault();

            const id        = Number(btnWish.dataset.id);
            // Obtener nombre del producto para el toast
            const tarjeta   = btnWish.closest('.tarjeta-producto');
            const nombre    = tarjeta?.querySelector('.nombre-producto')?.textContent.trim() ?? 'Producto';
            const resultado = toggleFavorito(id);

            if (resultado.requiereLogin) {
                window.dispatchEvent(new CustomEvent('auth:solicitar-login', { detail: { tab: 'login' } }));
                return;
            }
            // Actualizar icono y estado en TODAS las tarjetas con ese id
            _sincronizarWishlistUI(id);
            mostrarToastCatalogo(
                resultado.accion === 'agregado'
                    ? `❤️ "${nombre}" guardado en tu lista de deseos`
                    : `"${nombre}" eliminado de la lista de deseos`
            );
            return;
        }

        // ── Vista rápida ────────────────────────────────────────────────
        const btnQV = e.target.closest('[data-btn-quickview]');
        if (btnQV) {
            abrirQuickView(Number(btnQV.dataset.id));
        }
    });

    // Escuchar cambios del admin (misma pestaña o localStorage)
    window.addEventListener('productos-actualizados', () => {
        // productService ya actualizó _cache — solo releer y renderizar
        productos = obtenerProductos().filter(p => p.visible);
        renderizar();
    });
    window.addEventListener('storage', (e) => {
        if (e.key === 'maye_productos') cargarYRenderizar();
    });

    // Re-sincronizar corazones cuando cambie la wishlist (login/logout/toggle)
    window.addEventListener('wishlist-actualizada', () => _sincronizarTodosWishlist());
}

function cargarYRenderizar() {
    // Mostrar skeleton mientras carga
    _mostrarSkeleton();

    // Garantizar que el caché de Supabase esté cargado antes de leer
    ensureProductosLoaded().then(() => {
        productos = obtenerProductos().filter(p => p.visible);
        renderizar();
    }).catch(err => {
        console.error('[Catálogo] Error al cargar productos:', err);
        // Fallback: intentar con lo que haya en caché (puede estar vacío)
        productos = obtenerProductos().filter(p => p.visible);
        renderizar();
    });
}

function renderizar() {
    const filtrados = productos.filter(p => {
        const porCategoria = categoriaActiva === 'todos' || p.categoria === categoriaActiva;
        const porTexto     = !textoBusqueda ||
            p.nombre.toLowerCase().includes(textoBusqueda) ||
            p.categoria.toLowerCase().includes(textoBusqueda);
        return porCategoria && porTexto;
    });

    if (contadorTotal) {
        contadorTotal.textContent = `${filtrados.length} producto${filtrados.length !== 1 ? 's' : ''}`;
    }

    if (filtrados.length === 0) {
        grilla.innerHTML = `
            <div class="catalogo-vacio">
                <i class="ri-search-line catalogo-vacio__icono"></i>
                <p class="catalogo-vacio__texto">No encontramos productos con ese criterio.</p>
                <button class="catalogo-vacio__btn" id="catalogo-ver-todos">Ver todos</button>
            </div>`;
        const btnReset = document.getElementById('catalogo-ver-todos');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                categoriaActiva = 'todos';
                textoBusqueda  = '';
                if (inputBusqueda) inputBusqueda.value = '';
                document.querySelectorAll('[data-categoria]').forEach(e => e.classList.remove('activo'));
                document.querySelectorAll('[data-categoria="todos"]').forEach(e => e.classList.add('activo'));
                renderizar();
                grilla.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        return;
    }

    grilla.innerHTML = filtrados.map((p, i) => tarjetaHTML(p, i)).join('');

    // Lazy-load + observer para animaciones de entrada
    grilla.querySelectorAll('.tarjeta-producto').forEach((el, i) => {
        el.style.animationDelay = `${i * 0.07}s`;
        el.classList.add('tarjeta-animada');
    });
}

// ── TEMPLATE DE TARJETA ───────────────────────────────────────────────────────
function tarjetaHTML(p) {
    const agotado  = p.stock === 0 || p.etiqueta === 'agotado';
    const etiqData = p.etiqueta && ETIQUETAS[p.etiqueta];
    const waURL    = waLink(p.whatsapp || encodeURIComponent(`Hola! Me interesa el producto ${p.nombre}`));
    const enLista  = esFavorito(p.id);

    const etiqHTML = etiqData
        ? `<span class="etiqueta-producto ${etiqData.clase}">${etiqData.texto}</span>`
        : '';

    const precioHTML = p.precioAnterior
        ? `<div class="precio-wrapper">
               <span class="precio-producto">${formatearPrecio(p.precio)}</span>
               <span class="precio-anterior">${formatearPrecio(p.precioAnterior)}</span>
           </div>`
        : `<div class="precio-wrapper">
               <span class="precio-producto">${formatearPrecio(p.precio)}</span>
           </div>`;

    const btnHTML = agotado
        ? `<button class="btn-comprar-tarjeta" disabled aria-disabled="true">
               <span><i class="ri-close-circle-line"></i> Agotado</span>
           </button>`
        : `<button class="btn-comprar-tarjeta"
               data-btn-carrito
               data-id="${p.id}"
               data-nombre="${p.nombre.replace(/"/g, '&quot;')}"
               data-precio="${p.precio}"
               data-imagen="${p.imagen}"
               aria-label="Agregar ${p.nombre} al carrito">
               <span><i class="ri-shopping-bag-3-line"></i> Agregar al carrito</span>
           </button>`;

    const detalleURL = `/paginas/producto.html?id=${p.id}`;

    // ── Botones flotantes sobre la imagen ──────────────────────────────
    const heartClass  = enLista ? 'btn-wishlist--activo' : '';
    const heartIcon   = enLista ? 'ri-heart-fill' : 'ri-heart-line';
    const heartLabel  = enLista ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos';

    return `
    <article class="tarjeta-producto${agotado ? ' agotada' : ''}" data-id="${p.id}">
        <a href="${detalleURL}" class="tarjeta-producto__enlace" aria-label="Ver detalle de ${p.nombre.replace(/"/g, '&quot;')}">
            <div class="imagen-producto-wrapper">
                <img src="${p.imagen}"
                     alt="${p.nombre}"
                     class="imagen-producto"
                     loading="lazy"
                     width="400" height="400"
                     onerror="this.src='https://placehold.co/400x400/FAF7F2/2A8C64?text=Maye'">
                ${etiqHTML}
                ${agotado ? '<div class="overlay-agotado"><span>Agotado</span></div>' : ''}

                <!-- Botones flotantes: wishlist + vista rápida -->
                <div class="tarjeta-overlay-acciones" aria-label="Acciones rápidas">
                    <button class="tarjeta-accion-btn btn-wishlist ${heartClass}"
                            data-btn-wishlist
                            data-id="${p.id}"
                            aria-label="${heartLabel}"
                            aria-pressed="${enLista}"
                            type="button">
                        <i class="${heartIcon}"></i>
                    </button>
                </div>

                <!-- Vista rápida (barra inferior) -->
                <button class="btn-vista-rapida"
                        data-btn-quickview
                        data-id="${p.id}"
                        type="button"
                        aria-label="Vista rápida de ${p.nombre.replace(/"/g, '&quot;')}">
                    <i class="ri-eye-line"></i> Vista rápida
                </button>
            </div>
        </a>
        <div class="info-producto">
            <span class="categoria-tag">${categoriaLabel(p.categoria)}</span>
            <h3 class="nombre-producto"><a href="${detalleURL}">${p.nombre}</a></h3>
            ${precioHTML}
            ${btnHTML}
        </div>
    </article>`;
}

const CAT_LABELS = {
    capilar: 'Cuidado Capilar', maquillaje: 'Maquillaje',
    unas: 'Uñas', skincare: 'Skincare', todos: 'General',
};
function categoriaLabel(cat) { return CAT_LABELS[cat] ?? cat; }

// ── SKELETON ──────────────────────────────────────────────────────────────────
function _mostrarSkeleton() {
    if (!grilla) return;
    grilla.innerHTML = Array.from({ length: 6 }).map(() => `
        <article class="tarjeta-producto">
            <div class="imagen-producto-wrapper skeleton" style="height:280px;border-radius:var(--radio-lg)"></div>
            <div class="info-producto" style="padding:14px 12px;display:flex;flex-direction:column;gap:8px">
                <div class="skeleton" style="height:12px;width:50%;border-radius:4px"></div>
                <div class="skeleton" style="height:18px;width:80%;border-radius:4px"></div>
                <div class="skeleton" style="height:22px;width:40%;border-radius:4px"></div>
                <div class="skeleton" style="height:38px;width:100%;border-radius:8px"></div>
            </div>
        </article>`).join('');
    if (contadorTotal) contadorTotal.textContent = 'Cargando…';
}

// ── SINCRONIZAR CORAZONES ────────────────────────────────────────────────────
// Actualiza el ícono/estado de todos los botones wishlist de una tarjeta por id
function _sincronizarWishlistUI(productId) {
    if (!grilla) return;
    const enLista = esFavorito(productId);
    grilla.querySelectorAll(`[data-btn-wishlist][data-id="${productId}"]`).forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) icon.className = enLista ? 'ri-heart-fill' : 'ri-heart-line';
        btn.classList.toggle('btn-wishlist--activo', enLista);
        btn.setAttribute('aria-pressed', enLista);
        btn.setAttribute('aria-label', enLista ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos');
        // Efecto latido
        btn.classList.add('btn-wishlist--pulso');
        setTimeout(() => btn.classList.remove('btn-wishlist--pulso'), 500);
    });
}

// Recorre TODOS los botones de la grilla y sincroniza con el estado actual
function _sincronizarTodosWishlist() {
    if (!grilla) return;
    grilla.querySelectorAll('[data-btn-wishlist]').forEach(btn => {
        const id      = Number(btn.dataset.id);
        const enLista = esFavorito(id);
        const icon    = btn.querySelector('i');
        if (icon) icon.className = enLista ? 'ri-heart-fill' : 'ri-heart-line';
        btn.classList.toggle('btn-wishlist--activo', enLista);
        btn.setAttribute('aria-pressed', enLista);
        btn.setAttribute('aria-label', enLista ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos');
    });
}

// ── TOAST DEL CATÁLOGO ────────────────────────────────────────────────────────

function inyectarToastContainer() {
    if (document.getElementById('catalogo-toast-container')) return;
    const container = document.createElement('div');
    container.id = 'catalogo-toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
}

let _toastTimer = null;
function mostrarToastCatalogo(texto) {
    const container = document.getElementById('catalogo-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i class="ri-shopping-bag-3-line toast__icono"></i>
        <span>${texto}</span>`;

    container.appendChild(toast);

    // Eliminar el toast después de la animación
    setTimeout(() => {
        toast.classList.add('saliendo');
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// ── FEEDBACK VISUAL DEL BOTÓN ────────────────────────────────────────────────

function feedbackBoton(btn) {
    if (btn.disabled) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<span><i class="ri-check-line"></i> Agregado</span>';
    btn.classList.add('btn-comprar-tarjeta--agregado');
    btn.disabled = true;

    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('btn-comprar-tarjeta--agregado');
        btn.disabled = false;
    }, 1500);
}
