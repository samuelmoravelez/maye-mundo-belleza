// js/components/quickView.js
// ─────────────────────────────────────────────────────────────────────────────
// Modal de Vista Rápida de Producto — Maye Mundo Belleza
//
// Uso:
//   import { iniciarQuickView, abrirQuickView } from '../components/quickView.js';
//   iniciarQuickView();                // llamar 1 vez en DOMContentLoaded
//   abrirQuickView(productoId);        // llamar desde cualquier botón
// ─────────────────────────────────────────────────────────────────────────────

import { obtenerProductos, formatearPrecio, ETIQUETAS, CATEGORIAS } from '../data/productos.data.js';
import { agregarItem }                   from '../utils/carrito.js';
import { toggleFavorito, esFavorito }    from '../utils/wishlistService.js';
import { RUTAS }                         from '../utils/constants.js';

// ── ID del overlay ────────────────────────────────────────────────────────────
const MODAL_ID = 'qv-overlay';

// ── Inyectar el HTML del modal (1 sola vez) ───────────────────────────────────
function _crearModal() {
    if (document.getElementById(MODAL_ID)) return;
    document.body.insertAdjacentHTML('beforeend', `
<div class="qv-overlay" id="${MODAL_ID}"
     role="dialog" aria-modal="true" aria-labelledby="qv-titulo"
     aria-hidden="true">
    <div class="qv-modal">

        <!-- Botón cerrar -->
        <button class="qv-cerrar" id="qv-cerrar"
                aria-label="Cerrar vista rápida">
            <i class="ri-close-line"></i>
        </button>

        <!-- Imagen -->
        <div class="qv-imagen-wrap">
            <img src="" alt="" id="qv-imagen" class="qv-imagen"
                 onerror="this.src='https://placehold.co/480x480/FAF7F2/2A8C64?text=Maye'">
            <span class="qv-etiqueta" id="qv-etiqueta" hidden></span>
        </div>

        <!-- Info -->
        <div class="qv-info">
            <span class="qv-categoria" id="qv-categoria"></span>
            <h2 class="qv-titulo" id="qv-titulo"></h2>

            <div class="qv-precios" id="qv-precios"></div>

            <p class="qv-descripcion" id="qv-descripcion"></p>

            <!-- Stock -->
            <div class="qv-stock" id="qv-stock-wrap">
                <span class="qv-stock__dot" id="qv-stock-dot"></span>
                <span class="qv-stock__txt" id="qv-stock-txt"></span>
            </div>

            <!-- Cantidad -->
            <div class="qv-cantidad-wrap" id="qv-cantidad-wrap">
                <label class="qv-cantidad-label" for="qv-cantidad">Cantidad</label>
                <div class="qv-cantidad-ctrl">
                    <button class="qv-cantidad-btn" id="qv-decrement"
                            aria-label="Reducir cantidad">
                        <i class="ri-subtract-line"></i>
                    </button>
                    <input class="qv-cantidad-input" type="number"
                           id="qv-cantidad" value="1" min="1" max="99"
                           aria-label="Cantidad">
                    <button class="qv-cantidad-btn" id="qv-increment"
                            aria-label="Aumentar cantidad">
                        <i class="ri-add-line"></i>
                    </button>
                </div>
            </div>

            <!-- Acciones -->
            <div class="qv-acciones">
                <button class="qv-btn qv-btn--carrito" id="qv-btn-carrito"
                        aria-label="Agregar al carrito">
                    <i class="ri-shopping-bag-3-line"></i>
                    Agregar al carrito
                </button>
                <button class="qv-btn qv-btn--wishlist" id="qv-btn-wishlist"
                        aria-label="Agregar a lista de deseos">
                    <i class="ri-heart-line" id="qv-heart-icon"></i>
                </button>
            </div>

            <!-- Enlace detalle -->
            <a class="qv-ver-detalle" id="qv-ver-detalle"
               href="#" aria-label="Ver página completa del producto">
                <i class="ri-external-link-line"></i>
                Ver página completa
            </a>
        </div><!-- /.qv-info -->

    </div><!-- /.qv-modal -->
</div>`);
}

// ── Estado ────────────────────────────────────────────────────────────────────
let _productoActual = null;

// ── Abrir modal ───────────────────────────────────────────────────────────────
export function abrirQuickView(productId) {
    const productos = obtenerProductos();
    const p = productos.find(x => String(x.id) === String(productId));
    if (!p) return;

    _productoActual = p;
    _rellenarModal(p);

    const overlay = document.getElementById(MODAL_ID);
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('qv-overlay--visible');
    document.body.style.overflow = 'hidden';

    // Focus al cerrar para accesibilidad
    setTimeout(() => document.getElementById('qv-cerrar')?.focus(), 200);
}

// ── Cerrar modal ──────────────────────────────────────────────────────────────
function _cerrarModal() {
    const overlay = document.getElementById(MODAL_ID);
    if (!overlay) return;
    overlay.classList.remove('qv-overlay--visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    _productoActual = null;
    // Resetear cantidad
    const qty = document.getElementById('qv-cantidad');
    if (qty) qty.value = 1;
}

// ── Rellenar contenido ────────────────────────────────────────────────────────
function _rellenarModal(p) {
    const agotado = p.stock === 0 || p.etiqueta === 'agotado';

    // Imagen
    const img = document.getElementById('qv-imagen');
    img.src = p.imagen;
    img.alt = p.nombre;

    // Etiqueta
    const etiqEl = document.getElementById('qv-etiqueta');
    const etiqData = p.etiqueta && ETIQUETAS[p.etiqueta];
    if (etiqData && !agotado) {
        etiqEl.textContent = etiqData.texto;
        etiqEl.className   = `qv-etiqueta etiqueta-producto ${etiqData.clase}`;
        etiqEl.removeAttribute('hidden');
    } else {
        etiqEl.setAttribute('hidden', '');
    }

    // Categoría
    const catLabel = CATEGORIAS.find(c => c.id === p.categoria)?.label ?? p.categoria;
    document.getElementById('qv-categoria').textContent = catLabel;

    // Título
    document.getElementById('qv-titulo').textContent = p.nombre;

    // Precios
    const preciosEl = document.getElementById('qv-precios');
    if (p.precioAnterior) {
        preciosEl.innerHTML = `
            <span class="qv-precio">${formatearPrecio(p.precio)}</span>
            <span class="qv-precio-ant">${formatearPrecio(p.precioAnterior)}</span>
            <span class="qv-descuento">
                -${Math.round((1 - p.precio / p.precioAnterior) * 100)}%
            </span>`;
    } else {
        preciosEl.innerHTML = `<span class="qv-precio">${formatearPrecio(p.precio)}</span>`;
    }

    // Descripción
    const descEl = document.getElementById('qv-descripcion');
    descEl.textContent = p.descripcion || 'Sin descripción disponible.';

    // Stock
    const dotEl = document.getElementById('qv-stock-dot');
    const txtEl = document.getElementById('qv-stock-txt');
    if (agotado) {
        dotEl.className = 'qv-stock__dot qv-stock__dot--rojo';
        txtEl.textContent = 'Agotado';
    } else if (p.stock <= 5) {
        dotEl.className = 'qv-stock__dot qv-stock__dot--amarillo';
        txtEl.textContent = `¡Solo ${p.stock} disponibles!`;
    } else {
        dotEl.className = 'qv-stock__dot qv-stock__dot--verde';
        txtEl.textContent = `${p.stock} en stock`;
    }

    // Cantidad (max = stock disponible)
    const qtyInput = document.getElementById('qv-cantidad');
    qtyInput.max   = agotado ? 0 : p.stock;
    qtyInput.value = 1;
    const qvWrap   = document.getElementById('qv-cantidad-wrap');
    qvWrap.style.opacity      = agotado ? '0.45' : '1';
    qvWrap.style.pointerEvents = agotado ? 'none' : '';

    // Botón carrito
    const btnCart = document.getElementById('qv-btn-carrito');
    btnCart.disabled = agotado;
    btnCart.innerHTML = agotado
        ? '<i class="ri-close-circle-line"></i> Agotado'
        : '<i class="ri-shopping-bag-3-line"></i> Agregar al carrito';

    // Botón wishlist
    _actualizarBtnWishlist(p.id);

    // Link detalle
    document.getElementById('qv-ver-detalle').href =
        `${RUTAS.PRODUCTO}?id=${p.id}`;
}

// ── Actualiza el icono del corazón en el modal ────────────────────────────────
function _actualizarBtnWishlist(productId) {
    const btn  = document.getElementById('qv-btn-wishlist');
    const icon = document.getElementById('qv-heart-icon');
    if (!btn || !icon) return;
    const enLista = esFavorito(productId);
    icon.className = enLista ? 'ri-heart-fill' : 'ri-heart-line';
    btn.classList.toggle('qv-btn--wishlist-activo', enLista);
    btn.setAttribute('aria-label', enLista ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos');
}

// ── Inicializar (llamar 1 vez) ─────────────────────────────────────────────────
export function iniciarQuickView() {
    _crearModal();

    const overlay = document.getElementById(MODAL_ID);
    if (!overlay) return;

    // Cerrar con X
    document.getElementById('qv-cerrar')
        ?.addEventListener('click', _cerrarModal);

    // Cerrar al clic en backdrop
    overlay.addEventListener('click', e => {
        if (e.target === overlay) _cerrarModal();
    });

    // Cerrar con Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay.classList.contains('qv-overlay--visible')) {
            _cerrarModal();
        }
    });

    // +/- cantidad
    document.getElementById('qv-increment')?.addEventListener('click', () => {
        const inp = document.getElementById('qv-cantidad');
        const max = Number(inp.max);
        if (Number(inp.value) < max) inp.value = Number(inp.value) + 1;
    });
    document.getElementById('qv-decrement')?.addEventListener('click', () => {
        const inp = document.getElementById('qv-cantidad');
        if (Number(inp.value) > 1) inp.value = Number(inp.value) - 1;
    });

    // Agregar al carrito
    document.getElementById('qv-btn-carrito')?.addEventListener('click', () => {
        if (!_productoActual) return;
        const qty = Math.max(1, Number(document.getElementById('qv-cantidad').value) || 1);
        for (let i = 0; i < qty; i++) {
            agregarItem({
                id:     _productoActual.id,
                nombre: _productoActual.nombre,
                precio: _productoActual.precio,
                imagen: _productoActual.imagen,
            });
        }
        // Feedback visual
        const btn = document.getElementById('qv-btn-carrito');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="ri-check-line"></i> ¡Agregado!';
        btn.classList.add('qv-btn--success');
        setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('qv-btn--success');
        }, 1600);
    });

    // Toggle wishlist desde el modal
    document.getElementById('qv-btn-wishlist')?.addEventListener('click', () => {
        if (!_productoActual) return;
        const resultado = toggleFavorito(_productoActual.id);
        if (resultado.requiereLogin) {
            _cerrarModal();
            window.dispatchEvent(new CustomEvent('auth:solicitar-login', { detail: { tab: 'login' } }));
            return;
        }
        _actualizarBtnWishlist(_productoActual.id);
    });

    // Escuchar cambios de wishlist para actualizar el icono si el modal está abierto
    window.addEventListener('wishlist-actualizada', () => {
        if (_productoActual) _actualizarBtnWishlist(_productoActual.id);
    });
}
