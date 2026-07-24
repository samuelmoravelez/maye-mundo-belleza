// js/utils/carrito.js
// Responsabilidad: toda la lógica del carrito de compras.
// Persiste en localStorage bajo la clave STORAGE_KEYS.CARRITO.
// No depende de ningún componente UI — es pura lógica de datos.
// TODO acceso a almacenamiento pasa por js/utils/storage.js, dejando
// el proyecto listo para migrar a backend sin tocar este módulo.

import { formatearPrecio } from '../data/productos.data.js';
import Storage from './storage.js';
import { STORAGE_KEYS, waLink } from './constants.js';

const CLAVE = STORAGE_KEYS.CARRITO;

let _waLinkFn = waLink;

/**
 * Permite sobrescribir el generador de enlaces (para tests o aislar dependencias).
 * @internal
 */
export function _establecerWaLink(fn) { _waLinkFn = fn; }

// ── ESTRUCTURA de cada ítem ────────────────────────────────────────────────
// { id, nombre, precio, imagen, cantidad }

// ── LECTURA ────────────────────────────────────────────────────────────────
export function obtenerItems() {
    try {
        const items = Storage.obtener(CLAVE, []);
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

// ── ESCRITURA ──────────────────────────────────────────────────────────────
function persistir(items) {
    Storage.guardar(CLAVE, items);
    window.dispatchEvent(new CustomEvent('carrito-actualizado', { detail: { items } }));
}

// ── AGREGAR ────────────────────────────────────────────────────────────────
export function agregarItem({ id, nombre, precio, imagen }) {
    const items = obtenerItems();
    const idx   = items.findIndex(i => i.id === id);

    if (idx !== -1) {
        items[idx].cantidad += 1;
    } else {
        items.push({ id, nombre, precio, imagen, cantidad: 1 });
    }
    persistir(items);
}

// ── ELIMINAR ───────────────────────────────────────────────────────────────
export function eliminarItem(id) {
    persistir(obtenerItems().filter(i => i.id !== id));
}

// ── CAMBIAR CANTIDAD ───────────────────────────────────────────────────────
export function cambiarCantidad(id, cantidad) {
    const items = obtenerItems();
    const idx   = items.findIndex(i => i.id === id);
    if (idx === -1) return;

    if (cantidad <= 0) {
        items.splice(idx, 1);
    } else {
        items[idx].cantidad = cantidad;
    }
    persistir(items);
}

// ── VACIAR ─────────────────────────────────────────────────────────────────
export function vaciarCarrito() {
    persistir([]);
}

// ── TOTALES ────────────────────────────────────────────────────────────────
export function contarItems() {
    return obtenerItems().reduce((acc, i) => acc + i.cantidad, 0);
}

export function calcularTotal() {
    return obtenerItems().reduce((acc, i) => acc + i.precio * i.cantidad, 0);
}

// ── WHATSAPP ───────────────────────────────────────────────────────────────
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
