// js/pages/index.js
// Lógica exclusiva de index.html — botones "Agregar al carrito" de los
// productos destacados. Usa el carrito real (js/utils/carrito.js).

import { agregarItem } from '../utils/carrito.js';

export function iniciarBotonesCarrito() {
    const tarjetas = document.querySelectorAll('.tarjeta-producto');
    if (tarjetas.length === 0) return;

    tarjetas.forEach(tarjeta => {
        const btn = tarjeta.querySelector('.btn-comprar-tarjeta');
        if (!btn || btn.disabled) return;

        // Leer datos del producto: priorizar atributos data-destacado del botón
        // (usados en home) y hacer fallback a la data del article
        const id     = Number(btn.dataset.destacadoId)
                    || Number(tarjeta.dataset.id)
                    || generarIdDesdeNombre(tarjeta);
        const nombre = btn.dataset.destacadoNombre
                    || tarjeta.querySelector('.nombre-producto')?.textContent.trim()
                    || 'Producto';
        const imagen = btn.dataset.destacadoImagen
                    || tarjeta.querySelector('.imagen-producto')?.src
                    || '';
        const precio = Number(btn.dataset.destacadoPrecio)
                    || parsearPrecio(tarjeta.querySelector('.precio-producto')?.textContent ?? '0');

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            agregarItem({ id, nombre, precio, imagen });
            feedbackVisual(btn);
        });
    });
}

// ── HELPERS ────────────────────────────────────────────────────────────────

/** Extrae el número de un string como "$45.000 COP" → 45000 */
function parsearPrecio(texto) {
    return Number(texto.replace(/[^0-9]/g, '')) || 0;
}

/** Fallback de ID basado en el nombre cuando no hay data-id en el HTML */
function generarIdDesdeNombre(tarjeta) {
    const nombre = tarjeta.querySelector('.nombre-producto')?.textContent.trim() ?? '';
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
        hash = (hash << 5) - hash + nombre.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/** Feedback visual en el botón sin usar inline styles */
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
