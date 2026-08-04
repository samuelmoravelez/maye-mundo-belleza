// js/utils/carrito.js
// Fachada del carrito — delega en src/js/services/cartService.js

import { formatearPrecio } from '../data/productos.data.js';
import { STORAGE_KEYS, waLink } from './constants.js';
import {
    obtenerItems as _obtenerItems,
    agregarItem as _agregarItem,
    eliminarItem as _eliminarItem,
    cambiarCantidad as _cambiarCantidad,
    vaciarCarrito as _vaciarCarrito,
    contarItems as _contarItems,
    calcularTotal as _calcularTotal,
    syncCartFromRemote,
} from '../../src/js/services/cartService.js';

export { syncCartFromRemote };

let _waLinkFn = waLink;

/** @internal */
export function _establecerWaLink(fn) { _waLinkFn = fn; }

function _run(promise) {
    promise.catch(err => console.error('[carrito]', err));
}

export function obtenerItems() {
    return _obtenerItems();
}

export function agregarItem(item) {
    _run(_agregarItem(item));
}

export function eliminarItem(id) {
    _run(_eliminarItem(id));
}

export function cambiarCantidad(id, cantidad) {
    _run(_cambiarCantidad(id, cantidad));
}

export function vaciarCarrito() {
    _run(_vaciarCarrito());
}

export function contarItems() {
    return _contarItems();
}

export function calcularTotal() {
    return _calcularTotal();
}

export function generarMensajeWhatsApp() {
    const items = obtenerItems();
    if (items.length === 0) return null;

    const lineas = items.map(
        i => `• ${i.nombre} (${i.cantidad}) — ${formatearPrecio(i.precio * i.cantidad)}`
    );

    const total = formatearPrecio(calcularTotal());

    const mensaje = [
        'Hola, Maye Mundo Belleza.',
        '',
        'Quisiera realizar el siguiente pedido:',
        '',
        ...lineas,
        '',
        `Total: ${total}`,
        '',
        'Muchas gracias.',
    ].join('\n');

    return encodeURIComponent(mensaje);
}

export function generarEnlaceWhatsApp() {
    const msg = generarMensajeWhatsApp();
    if (!msg) return null;
    return _waLinkFn(msg);
}

export const CLAVE = STORAGE_KEYS.CARRITO;
