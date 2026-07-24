// js/pages/productos.js
// Catálogo dinámico: lee productos desde localStorage (admin) o defaults.
// Maneja filtros por categoría, búsqueda, renderizado de tarjetas y carrito.

import { obtenerProductos, formatearPrecio, ETIQUETAS } from '../data/productos.data.js';
import { agregarItem } from '../utils/carrito.js';
import { waLink } from '../utils/constants.js';

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
        const btn = e.target.closest('[data-btn-carrito]');
        if (!btn) return;

        const id     = Number(btn.dataset.id);
        const nombre = btn.dataset.nombre;
        const precio = Number(btn.dataset.precio);
        const imagen = btn.dataset.imagen;

        agregarItem({ id, nombre, precio, imagen });
        mostrarToastCatalogo(`${nombre} agregado al carrito`);
        feedbackBoton(btn);
    });

    // Escuchar cambios del admin (misma pestaña o localStorage)
    window.addEventListener('productos-actualizados', cargarYRenderizar);
    window.addEventListener('storage', (e) => {
        if (e.key === 'maye_productos') cargarYRenderizar();
    });
}

function cargarYRenderizar() {
    productos = obtenerProductos().filter(p => p.visible);
    renderizar();
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

    const detalleURL = `/maye-mundo-belleza/paginas/producto.html?id=${p.id}`;

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
