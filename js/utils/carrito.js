// js/utils/carrito.js
// Responsabilidad: toda la lógica del carrito de compras.
// Persiste en localStorage bajo la clave 'maye_carrito'.
// No depende de ningún componente UI — es pura lógica de datos.

import { formatearPrecio } from '../data/productos.data.js';

const CLAVE = 'maye_carrito';

// ── ESTRUCTURA de cada ítem ────────────────────────────────────────────────
// { id, nombre, precio, imagen, cantidad }

// ── LECTURA ────────────────────────────────────────────────────────────────
export function obtenerItems() {
    try {
        const raw = localStorage.getItem(CLAVE);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

// ── ESCRITURA ──────────────────────────────────────────────────────────────
function persistir(items) {
    localStorage.setItem(CLAVE, JSON.stringify(items));
    // Emitir evento global para que cualquier componente escuche
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

// ── MENSAJE WHATSAPP ───────────────────────────────────────────────────────
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
