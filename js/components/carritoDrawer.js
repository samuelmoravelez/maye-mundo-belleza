// js/components/carritoDrawer.js
// Responsabilidad: UI del panel lateral del carrito.
// Se inicializa en main.js para estar disponible en todas las páginas.
// Depende de: js/utils/carrito.js

import {
    obtenerItems,
    eliminarItem,
    cambiarCantidad,
    vaciarCarrito,
    contarItems,
    calcularTotal,
    generarMensajeWhatsApp,
} from '../utils/carrito.js';
import { formatearPrecio } from '../data/productos.data.js';

const WA_NUMERO = '573003091641';

// ── REFERENCIAS DOM (se resuelven en iniciar) ──────────────────────────────
let overlay, drawer, cuerpo, badgeHeader, btnCerrar, btnVaciar, btnWhatsApp;
let pieTotales, contadores;

// ── INICIALIZACIÓN ─────────────────────────────────────────────────────────
export function iniciarCarritoDrawer() {
    inyectarHTML();
    resolverRefs();
    adjuntarEventos();
    sincronizarContadores();

    // Escuchar cambios del carrito (desde cualquier módulo)
    window.addEventListener('carrito-actualizado', () => {
        renderizarItems();
        sincronizarContadores();
    });

    // Escuchar cambios desde otras pestañas
    window.addEventListener('storage', (e) => {
        if (e.key === 'maye_carrito') {
            renderizarItems();
            sincronizarContadores();
        }
    });
}

// ── INYECTAR HTML DEL DRAWER ───────────────────────────────────────────────
function inyectarHTML() {
    if (document.getElementById('carrito-overlay')) return; // ya existe

    document.body.insertAdjacentHTML('beforeend', `
        <div class="carrito-overlay" id="carrito-overlay"></div>

        <aside class="carrito-drawer" id="carrito-drawer" aria-label="Carrito de compras" role="complementary">
            <div class="carrito-drawer__header">
                <span class="carrito-drawer__titulo">
                    <i class="ri-shopping-bag-3-line"></i>
                    Mi Carrito
                    <span class="carrito-drawer__badge" id="carrito-badge-drawer">0</span>
                </span>
                <button class="carrito-drawer__cerrar" id="carrito-cerrar" aria-label="Cerrar carrito">
                    <i class="ri-close-line"></i>
                </button>
            </div>

            <div class="carrito-drawer__cuerpo" id="carrito-cuerpo">
                <!-- Items renderizados por JS -->
            </div>

            <div class="carrito-drawer__pie" id="carrito-pie" style="display:none">
                <div class="carrito-totales" id="carrito-totales"></div>
                <div class="carrito-drawer__acciones">
                    <button class="btn-pedir-whatsapp" id="btn-pedir-whatsapp">
                        <i class="ri-whatsapp-line"></i>
                        Realizar pedido por WhatsApp
                    </button>
                    <button class="btn-vaciar-carrito" id="btn-vaciar-carrito">
                        <i class="ri-delete-bin-line"></i>
                        Vaciar carrito
                    </button>
                </div>
            </div>
        </aside>
    `);
}

// ── RESOLVER REFERENCIAS ───────────────────────────────────────────────────
function resolverRefs() {
    overlay      = document.getElementById('carrito-overlay');
    drawer       = document.getElementById('carrito-drawer');
    cuerpo       = document.getElementById('carrito-cuerpo');
    badgeHeader  = document.getElementById('carrito-badge-drawer');
    btnCerrar    = document.getElementById('carrito-cerrar');
    btnVaciar    = document.getElementById('btn-vaciar-carrito');
    btnWhatsApp  = document.getElementById('btn-pedir-whatsapp');
    pieTotales   = document.getElementById('carrito-pie');
    contadores   = document.querySelectorAll('.contador-carrito');
}

// ── EVENTOS ────────────────────────────────────────────────────────────────
function adjuntarEventos() {
    // Abrir al hacer clic en cualquier .icono-carrito del header
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.icono-carrito');
        if (trigger) {
            e.preventDefault();
            abrirDrawer();
        }
    });

    // Cerrar
    btnCerrar.addEventListener('click', cerrarDrawer);
    overlay.addEventListener('click', cerrarDrawer);

    // Esc cierra
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('abierto')) cerrarDrawer();
    });

    // Vaciar
    btnVaciar.addEventListener('click', () => {
        vaciarCarrito();
    });

    // WhatsApp
    btnWhatsApp.addEventListener('click', () => {
        const msg = generarMensajeWhatsApp();
        if (!msg) return;
        window.open(`https://wa.me/${WA_NUMERO}?text=${msg}`, '_blank', 'noopener,noreferrer');
    });
}

// ── ABRIR / CERRAR ─────────────────────────────────────────────────────────
function abrirDrawer() {
    renderizarItems();
    drawer.classList.add('abierto');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    btnCerrar.focus();
}

function cerrarDrawer() {
    drawer.classList.remove('abierto');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
}

// ── RENDERIZADO ────────────────────────────────────────────────────────────
function renderizarItems() {
    const items = obtenerItems();

    if (items.length === 0) {
        cuerpo.innerHTML = `
            <div class="carrito-vacio">
                <i class="ri-shopping-bag-3-line carrito-vacio__icono"></i>
                <p class="carrito-vacio__titulo">Tu carrito está vacío</p>
                <p class="carrito-vacio__texto">Agrega productos desde nuestro catálogo y aparecerán aquí.</p>
                <a href="/paginas/productos.html" class="carrito-vacio__btn"
                   onclick="cerrarDrawer()">
                    <i class="ri-store-2-line"></i> Ver catálogo
                </a>
            </div>`;
        pieTotales.style.display = 'none';
        return;
    }

    cuerpo.innerHTML = items.map(item => itemHTML(item)).join('');
    pieTotales.style.display = 'flex';

    renderizarTotales(items);

    // Eventos de los ítems
    cuerpo.querySelectorAll('[data-accion-carrito]').forEach(btn => {
        btn.addEventListener('click', () => {
            const accion = btn.dataset.accionCarrito;
            const id     = Number(btn.dataset.id);

            if (accion === 'eliminar') eliminarItem(id);
            if (accion === 'incrementar') {
                const item = obtenerItems().find(i => i.id === id);
                if (item) cambiarCantidad(id, item.cantidad + 1);
            }
            if (accion === 'decrementar') {
                const item = obtenerItems().find(i => i.id === id);
                if (item) cambiarCantidad(id, item.cantidad - 1);
            }
        });
    });
}

function itemHTML(item) {
    const subtotal = formatearPrecio(item.precio * item.cantidad);
    const unitario = formatearPrecio(item.precio);
    const imgSrc   = item.imagen || 'https://placehold.co/72x72/FAF7F2/2A8C64?text=Maye';

    return `
    <div class="carrito-item" data-item-id="${item.id}">
        <img src="${imgSrc}" alt="${item.nombre}" class="carrito-item__imagen"
             onerror="this.src='https://placehold.co/72x72/FAF7F2/2A8C64?text=Maye'">

        <div class="carrito-item__info">
            <span class="carrito-item__nombre">${item.nombre}</span>
            <span class="carrito-item__precio-unit">${unitario} c/u</span>
            <div class="carrito-item__controles">
                <button class="carrito-item__btn-cant"
                        data-accion-carrito="decrementar" data-id="${item.id}"
                        aria-label="Reducir cantidad">
                    <i class="ri-subtract-line"></i>
                </button>
                <span class="carrito-item__cantidad">${item.cantidad}</span>
                <button class="carrito-item__btn-cant"
                        data-accion-carrito="incrementar" data-id="${item.id}"
                        aria-label="Aumentar cantidad">
                    <i class="ri-add-line"></i>
                </button>
            </div>
        </div>

        <div class="carrito-item__acciones">
            <button class="carrito-item__eliminar"
                    data-accion-carrito="eliminar" data-id="${item.id}"
                    aria-label="Eliminar ${item.nombre} del carrito">
                <i class="ri-close-line"></i>
            </button>
            <span class="carrito-item__subtotal">${subtotal}</span>
        </div>
    </div>`;
}

function renderizarTotales(items) {
    const subtotal = calcularTotal();
    const total    = subtotal; // sin envío por ahora

    document.getElementById('carrito-totales').innerHTML = `
        <div class="carrito-totales__fila">
            <span>${items.length} producto${items.length !== 1 ? 's' : ''}</span>
            <span>${formatearPrecio(subtotal)}</span>
        </div>
        <div class="carrito-totales__fila">
            <span>Envío</span>
            <span style="color:var(--verde-principal);font-weight:600">A coordinar</span>
        </div>
        <div class="carrito-totales__fila carrito-totales__fila--total">
            <span>Total estimado</span>
            <span>${formatearPrecio(total)}</span>
        </div>`;
}

// ── SINCRONIZAR TODOS LOS CONTADORES DEL HEADER ────────────────────────────
function sincronizarContadores() {
    const total = contarItems();

    // Contadores en el header (.contador-carrito)
    document.querySelectorAll('.contador-carrito').forEach(el => {
        el.textContent = total;
        if (total > 0) {
            el.classList.add('bump');
            setTimeout(() => el.classList.remove('bump'), 400);
        }
    });

    // Badge dentro del drawer
    if (badgeHeader) badgeHeader.textContent = total;
}
