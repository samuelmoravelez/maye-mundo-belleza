// js/pages/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Lógica exclusiva de index.html — productos destacados.
//
// CORRECCIÓN DE BUG CRÍTICO (foreign key wishlist_items_product_id_fkey):
//
//   Las tarjetas estáticas del HTML tienen data-destacado-id="1", "2", "3"
//   que son los IDs del array PRODUCTOS_DEFAULT (fallback local). Pero en
//   Supabase la tabla `products` tiene su propio `id` INTEGER autoincremental
//   que solo coincide con 1/2/3 si los registros se insertaron exactamente
//   en ese orden. En cualquier otro entorno (staging, fresh deploy, borrado
//   y re-insert) los IDs reales son distintos: 42, 103, etc.
//
//   Resultado:
//     • wishlist_items.insert({ product_id: 2 }) → FK violation → error RLS
//     • abrirQuickView(2) → find() no halla nada → modal vacío
//     • agregarItem({ id: 2 }) → cart_items.insert({ product_id: 2 }) → FK error
//
//   SOLUCIÓN:
//     Cuando entry-index.js invoca iniciarBotonesCarrito(), el catálogo de
//     Supabase ya está en caché (el entry hizo await ensureProductosLoaded()).
//     Esta función cruza cada tarjeta estática con el catálogo real usando
//     el nombre del producto como clave de búsqueda, obtiene el ID real de
//     Supabase y lo escribe en data-id del <article> y en todos los botones.
//     Si Supabase no tiene un producto con ese nombre (catálogo vacío o
//     desincronizado), se usa el ID local como fallback.
// ─────────────────────────────────────────────────────────────────────────────

import { agregarItem }                      from '../utils/carrito.js';
import { toggleFavorito, esFavorito }       from '../utils/wishlistService.js';
import { abrirQuickView, iniciarQuickView } from '../components/quickView.js';
import { obtenerProductos }                 from '../data/productos.data.js';

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function iniciarBotonesCarrito() {
    const tarjetas = document.querySelectorAll('.tarjeta-producto');
    if (tarjetas.length === 0) return;

    // El catálogo ya está en caché (entry-index hizo await ensureProductosLoaded)
    const catalogoSupabase = obtenerProductos();

    // Inyectar el modal de quickview una sola vez
    iniciarQuickView();

    tarjetas.forEach(tarjeta => _montarTarjeta(tarjeta, catalogoSupabase));

    _registrarDelegacion();
    _escucharWishlistActualizada();
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTAR UNA TARJETA INDIVIDUAL
// ─────────────────────────────────────────────────────────────────────────────
function _montarTarjeta(tarjeta, catalogo) {
    // ── 1. Leer datos del HTML estático ──────────────────────────────────
    const btnComprar    = tarjeta.querySelector('.btn-comprar-tarjeta');
    const nombreEl      = tarjeta.querySelector('.nombre-producto');
    const precioEl      = tarjeta.querySelector('.precio-producto');
    const imgEl         = tarjeta.querySelector('.imagen-producto');

    const nombreHtml    = (
        btnComprar?.dataset.destacadoNombre
        || nombreEl?.textContent.trim()
        || ''
    ).trim();

    const idHtml        = Number(btnComprar?.dataset.destacadoId)
                       || Number(tarjeta.dataset.id)
                       || 0;

    const imagenHtml    = btnComprar?.dataset.destacadoImagen
                       || imgEl?.src
                       || '';

    const precioHtml    = Number(btnComprar?.dataset.destacadoPrecio)
                       || _parsearPrecio(precioEl?.textContent ?? '0');

    // ── 2. Cruzar con el catálogo real de Supabase ───────────────────────
    //   Estrategia de búsqueda (en orden de prioridad):
    //     a) Por id exacto (funciona si el HTML ya tiene el UUID/integer correcto)
    //     b) Por nombre normalizado (match insensible a mayúsculas y tildes)
    //     c) Fallback: usar el idHtml del HTML estático (puede fallar en FK)
    const prod = _buscarEnCatalogo(catalogo, idHtml, nombreHtml);

    const idReal   = prod?.id   ?? idHtml;
    const nombre   = (prod?.nombre ?? nombreHtml)  || 'Producto';
    const imagen   = (prod?.imagen ?? imagenHtml)  || '';
    const precio   = (prod?.precio ?? precioHtml)  || 0;

    if (!prod && idHtml) {
        // El producto del HTML no existe en Supabase todavía.
        // Solo advertimos en desarrollo; en producción funciona con el fallback.
        console.warn(
            `[index] Producto "${nombreHtml}" (id=${idHtml}) no encontrado en` +
            ` el catálogo de Supabase. Se usará el ID local como fallback.` +
            ` Verifica que los datos estén insertados en la BD.`
        );
    }

    // ── 3. Escribir el ID real en el DOM ─────────────────────────────────
    // Esto hace que la delegación de eventos siempre lea el ID correcto.
    tarjeta.dataset.id = idReal;

    // Actualizar también el botón de comprar para consistencia
    if (btnComprar) {
        btnComprar.dataset.destacadoId     = idReal;
        btnComprar.dataset.destacadoNombre = nombre;
        btnComprar.dataset.destacadoPrecio = precio;
        btnComprar.dataset.destacadoImagen = imagen;
    }

    // Actualizar el href del enlace de detalle si lo hay
    const enlaceDetalle = tarjeta.querySelector(
        `a[href*="producto.html"]`
    );
    if (enlaceDetalle && idReal) {
        enlaceDetalle.href = `/paginas/producto.html?id=${idReal}`;
    }

    // ── 4. Listener del botón "Agregar al carrito" ────────────────────────
    if (btnComprar && !btnComprar.disabled) {
        // Remover listener anterior (si la tarjeta se re-montó)
        const nuevo = btnComprar.cloneNode(true);
        btnComprar.replaceWith(nuevo);

        nuevo.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            agregarItem({ id: idReal, nombre, precio, imagen });
            _feedbackVisual(nuevo);
        });
    }

    // ── 5. Inyectar botones flotantes (wishlist + quickview) ──────────────
    const wrapper = tarjeta.querySelector('.imagen-producto-wrapper');
    if (!wrapper) return;

    // Eliminar overlay anterior si existía (evita duplicados en re-mounts)
    wrapper.querySelector('.tarjeta-overlay-acciones')?.remove();
    wrapper.querySelector('.btn-vista-rapida')?.remove();

    const enLista  = esFavorito(idReal);
    const heartCls = enLista ? 'btn-wishlist--activo' : '';
    const heartIco = enLista ? 'ri-heart-fill' : 'ri-heart-line';
    const heartLbl = enLista ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos';

    wrapper.insertAdjacentHTML('beforeend', `
        <div class="tarjeta-overlay-acciones" aria-label="Acciones rápidas">
            <button class="tarjeta-accion-btn btn-wishlist ${heartCls}"
                    data-btn-wishlist
                    data-id="${idReal}"
                    aria-label="${heartLbl}"
                    aria-pressed="${enLista}"
                    type="button">
                <i class="${heartIco}"></i>
            </button>
        </div>
        <button class="btn-vista-rapida"
                data-btn-quickview
                data-id="${idReal}"
                type="button"
                aria-label="Vista rápida de ${_escaparAttr(nombre)}">
            <i class="ri-eye-line"></i> Vista rápida
        </button>`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELEGACIÓN DE EVENTOS (una sola vez en document)
// ─────────────────────────────────────────────────────────────────────────────
let _delegacionRegistrada = false;

function _registrarDelegacion() {
    // Evitar duplicar el listener si el módulo se re-inicializa
    if (_delegacionRegistrada) return;
    _delegacionRegistrada = true;

    document.addEventListener('click', e => {

        // ── Wishlist ──────────────────────────────────────────────────────
        const btnWish = e.target.closest('[data-btn-wishlist]');
        if (btnWish?.closest('.tarjeta-producto')) {
            e.preventDefault();
            const pid = Number(btnWish.dataset.id);
            if (!pid) {
                console.warn('[index] wishlist: id vacío en el botón, se omite.');
                return;
            }

            const yaEnLista = esFavorito(pid);

            // Feedback optimista inmediato
            _actualizarBotonesWishlist(pid, !yaEnLista);

            toggleFavorito(pid)
                .then(resultado => {
                    if (resultado.requiereLogin) {
                        _actualizarBotonesWishlist(pid, yaEnLista); // revertir
                        window.location.href = '/login.html';
                        return;
                    }
                    if (!resultado.ok) {
                        console.warn('[index] toggleFavorito error:', resultado.error);
                        _actualizarBotonesWishlist(pid, yaEnLista); // revertir
                        return;
                    }
                    // Confirmado por Supabase — animar pulso
                    document.querySelectorAll(`[data-btn-wishlist][data-id="${pid}"]`)
                        .forEach(btn => {
                            btn.classList.add('btn-wishlist--pulso');
                            setTimeout(() => btn.classList.remove('btn-wishlist--pulso'), 500);
                        });
                })
                .catch(err => {
                    console.error('[index] toggleFavorito fallo inesperado:', err);
                    _actualizarBotonesWishlist(pid, yaEnLista); // revertir
                });

            return;
        }

        // ── Quick View ────────────────────────────────────────────────────
        const btnQV = e.target.closest('[data-btn-quickview]');
        if (btnQV?.closest('.tarjeta-producto')) {
            e.preventDefault();
            const pid = Number(btnQV.dataset.id);
            if (!pid) {
                console.warn('[index] quickview: id vacío en el botón, se omite.');
                return;
            }
            // abrirQuickView es async — capturar errores
            abrirQuickView(pid).catch(err =>
                console.error('[index] abrirQuickView error:', err)
            );
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZACIÓN DE CORAZONES (login/logout/cambio de wishlist)
// ─────────────────────────────────────────────────────────────────────────────
function _escucharWishlistActualizada() {
    window.addEventListener('wishlist-actualizada', () => {
        document.querySelectorAll('[data-btn-wishlist]').forEach(btn => {
            const pid     = Number(btn.dataset.id);
            const enLista = esFavorito(pid);
            const ico     = btn.querySelector('i');
            if (ico) ico.className = enLista ? 'ri-heart-fill' : 'ri-heart-line';
            btn.classList.toggle('btn-wishlist--activo', enLista);
            btn.setAttribute('aria-pressed', String(enLista));
            btn.setAttribute('aria-label',
                enLista ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos');
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca un producto en el catálogo de Supabase usando:
 *   1. ID exacto (si ya coincide — caso normal después de una sincronización)
 *   2. Nombre normalizado (insensible a mayúsculas, tildes y espacios extra)
 *
 * @param {object[]} catalogo  — array de productos de Supabase
 * @param {number}   idHtml    — id del HTML estático (puede ser incorrecto)
 * @param {string}   nombre    — nombre del producto del HTML
 * @returns {object|null}
 */
function _buscarEnCatalogo(catalogo, idHtml, nombre) {
    if (!catalogo.length) return null;

    // a) ID exacto
    if (idHtml) {
        const porId = catalogo.find(p => Number(p.id) === Number(idHtml));
        if (porId) return porId;
    }

    // b) Nombre normalizado
    if (nombre) {
        const clave = _normalizar(nombre);
        const porNombre = catalogo.find(p => _normalizar(p.nombre) === clave);
        if (porNombre) return porNombre;

        // c) Nombre parcial (contiene) — útil si el HTML tiene texto recortado
        const parcial = catalogo.find(p =>
            _normalizar(p.nombre).includes(clave) ||
            clave.includes(_normalizar(p.nombre))
        );
        if (parcial) return parcial;
    }

    return null;
}

/** Normaliza texto para comparación: minúsculas, sin tildes, sin espacios extra */
function _normalizar(texto) {
    return String(texto ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function _actualizarBotonesWishlist(pid, enLista) {
    document.querySelectorAll(`[data-btn-wishlist][data-id="${pid}"]`).forEach(btn => {
        const ico = btn.querySelector('i');
        if (ico) ico.className = enLista ? 'ri-heart-fill' : 'ri-heart-line';
        btn.classList.toggle('btn-wishlist--activo', enLista);
        btn.setAttribute('aria-pressed', String(enLista));
        btn.setAttribute('aria-label',
            enLista ? 'Quitar de lista de deseos' : 'Agregar a lista de deseos');
    });
}

function _parsearPrecio(texto) {
    return Number(String(texto).replace(/[^0-9]/g, '')) || 0;
}

function _escaparAttr(texto) {
    return String(texto).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _feedbackVisual(btn) {
    const original = btn.innerHTML;
    btn.innerHTML = '<span><i class="ri-check-line"></i> Agregado</span>';
    btn.classList.add('btn-comprar-tarjeta--agregado');
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('btn-comprar-tarjeta--agregado');
        btn.disabled  = false;
    }, 1500);
}
