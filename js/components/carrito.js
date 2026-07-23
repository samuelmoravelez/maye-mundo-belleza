// js/components/carrito.js
// Responsabilidad: sincronizar el contador del carrito en el header.

import Storage from '../utils/storage.js';

export function iniciarCarrito() {
    const contadorCarrito = document.querySelector('.contador-carrito');

    if (!contadorCarrito) return;

    contadorCarrito.textContent = Storage.obtener('carrito', 0);
}
