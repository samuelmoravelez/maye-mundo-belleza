// js/pages/index.js
// Lógica exclusiva de index.html — botones "Agregar al carrito" de los
// productos destacados. Usa el carrito real (js/utils/carrito.js).

import { agregarItem }                         from '../utils/carrito.js';
import { toggleFavorito, esFavorito }          from '../utils/wishlistService.js';
import { abrirQuickView, iniciarQuickView }    from '../components/quickView.js';

export function iniciarBotonesCarrito() {
    const tarjetas = document.querySelectorAll('.tarjeta-producto');
    if (tarjetas.length === 0) return;

    // Iniciar quick-view (inyecta el modal una sola vez)
    iniciarQuickView();

    tarjetas.forEach(tarjeta => {
        const id     = Number(tarjeta.dataset.id)
                    || generarIdDesdeNombre(tarjeta);
        const nombre = tarjeta.querySelector('.nombre-producto')?.textContent.trim() || 'Producto';
        const imagen = tarjeta.querySelector('.imagen-producto')?.src || '';
        const precio = parsearPrecio(tarjeta.querySelector('.precio-producto')?.textContent ?? '0');

        // ── Botón agregar al carrito ──────────────────────────────────
        const btnCarrito = tarjeta.querySelector('.btn-comprar-tarjeta');
        if (btnCarrito && !btnCarrito.disabled) {
            // Leer overrides del dataset del botón (más fiable en tarjetas estáticas)
            const idFinal     = Number(btnCarrito.dataset.destacadoId)     || id;
            const nombreFinal = btnCarrito.dataset.destacadoNombre         || nombre;
            const imagenFinal = btnCarrito.dataset.destacadoImagen         || imagen;
            const precioFinal = Number(btnCarrito.dataset.destacadoPrecio) || precio;

            btnCarrito.addEventListener('click', e => {
                e.preventDefault();
                agregarItem({ id: idFinal, nombre: nombreFinal, precio: precioFinal, imagen: imagenFinal });
                feedbackVisual(btnCarrito);
            });
        }

        // ── Inyectar botones flotantes si la tarjeta aún no los tiene ─
        const wrapper = tarjeta.querySelector('.imagen-producto-wrapper');
        if (wrapper && !wrapper.querySelector('.tarjeta-overlay-acciones')) {
            const enLista   = esFavorito(id);
            const heartCls  = enLista ? 'btn-wishlist--activo' : '';
            const heartIco  = enLista ? 'ri-heart-fill' : 'ri-heart-line';
            const heartLbl  = enLista ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos';

            // Overlay con corazón
            wrapper.insertAdjacentHTML('beforeend', `
                <div class="tarjeta-overlay-acciones" aria-label="Acciones rápidas">
                    <button class="tarjeta-accion-btn btn-wishlist ${heartCls}"
                            data-btn-wishlist data-id="${id}"
                            aria-label="${heartLbl}" aria-pressed="${enLista}"
                            type="button">
                        <i class="${heartIco}"></i>
                    </button>
                </div>
                <button class="btn-vista-rapida"
                        data-btn-quickview data-id="${id}"
                        type="button"
                        aria-label="Vista rápida de ${nombre}">
                    <i class="ri-eye-line"></i> Vista rápida
                </button>`);
        }
    });

    // ── Delegación única en body para las tarjetas estáticas ─────────
    document.addEventListener('click', e => {
        // Wishlist
        const btnWish = e.target.closest('[data-btn-wishlist]');
        if (btnWish && document.querySelector('.tarjeta-producto')?.contains(btnWish) ||
            btnWish?.closest('.tarjeta-producto')) {
            e.preventDefault();
            const pid      = Number(btnWish.dataset.id);
            const resultado = toggleFavorito(pid);
            if (resultado.requiereLogin) {
                window.dispatchEvent(new CustomEvent('auth:solicitar-login', { detail: { tab: 'login' } }));
                return;
            }
            // Actualizar todos los corazones de esa tarjeta
            const enLista = esFavorito(pid);
            document.querySelectorAll(`[data-btn-wishlist][data-id="${pid}"]`).forEach(btn => {
                const ico = btn.querySelector('i');
                if (ico) ico.className = enLista ? 'ri-heart-fill' : 'ri-heart-line';
                btn.classList.toggle('btn-wishlist--activo', enLista);
                btn.setAttribute('aria-pressed', enLista);
                btn.setAttribute('aria-label', enLista ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos');
                btn.classList.add('btn-wishlist--pulso');
                setTimeout(() => btn.classList.remove('btn-wishlist--pulso'), 500);
            });
            return;
        }

        // Quick View
        const btnQV = e.target.closest('[data-btn-quickview]');
        if (btnQV?.closest('.tarjeta-producto')) {
            e.preventDefault();
            abrirQuickView(Number(btnQV.dataset.id));
        }
    });

    // Re-sincronizar corazones al cambiar wishlist (p.ej. tras login/logout)
    window.addEventListener('wishlist-actualizada', () => {
        document.querySelectorAll('[data-btn-wishlist]').forEach(btn => {
            const pid     = Number(btn.dataset.id);
            const enLista = esFavorito(pid);
            const ico     = btn.querySelector('i');
            if (ico) ico.className = enLista ? 'ri-heart-fill' : 'ri-heart-line';
            btn.classList.toggle('btn-wishlist--activo', enLista);
            btn.setAttribute('aria-pressed', enLista);
        });
    });
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function parsearPrecio(texto) {
    return Number(texto.replace(/[^0-9]/g, '')) || 0;
}

function generarIdDesdeNombre(tarjeta) {
    const nombre = tarjeta.querySelector('.nombre-producto')?.textContent.trim() ?? '';
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
        hash = (hash << 5) - hash + nombre.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function feedbackVisual(btn) {
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<span><i class="ri-check-line"></i> Agregado</span>';
    btn.classList.add('btn-comprar-tarjeta--agregado');
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML  = textoOriginal;
        btn.classList.remove('btn-comprar-tarjeta--agregado');
        btn.disabled   = false;
    }, 1500);
}
