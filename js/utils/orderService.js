// js/utils/orderService.js
// ─────────────────────────────────────────────────────────────────────────────
// Capa de servicio de Órdenes — Maye Mundo Belleza
//
// Responsabilidades:
//   - Crear, leer y actualizar órdenes en localStorage (maye_orders).
//   - Descontar stock de productos tras una compra exitosa.
//   - Vaciar el carrito al confirmar el pedido.
//   - Arquitectura async/await lista para migrar a API real.
//
// Estructura normalizada de una orden:
// {
//   id:           "ORD-1722112345",
//   userId:       "usr_xxx",
//   customerInfo: { name, phone, address, city, notes },
//   items:        [{ productId, title, price, quantity, imagen }],
//   pricing:      { subtotal, shipping, total },
//   paymentMethod:"nequi" | "bancolombia" | "contraentrega",
//   status:       "pending" | "enviado" | "completado" | "cancelado",
//   createdAt:    ISO string,
//   updatedAt:    ISO string,
// }
// ─────────────────────────────────────────────────────────────────────────────

import Storage from './storage.js';
import { STORAGE_KEYS, SHIPPING_COST } from './constants.js';
import { obtenerProductos, guardarProductos } from '../data/productos.data.js';
import { vaciarCarrito } from './carrito.js';

// ── Claves ────────────────────────────────────────────────────────────────────
const ORDERS_KEY = STORAGE_KEYS.ORDERS;

// ── Errores tipados ───────────────────────────────────────────────────────────
export const ORDER_ERRORS = Object.freeze({
    EMPTY_CART:     'EMPTY_CART',
    MISSING_FIELDS: 'MISSING_FIELDS',
    OUT_OF_STOCK:   'OUT_OF_STOCK',
    NOT_FOUND:      'NOT_FOUND',
    FORBIDDEN:      'FORBIDDEN',
});

// ── Generador de ID correlativo ────────────────────────────────────────────────
function _generarOrderId() {
    const ts     = Date.now();
    const orders = _getAllOrders();
    // Número correlativo basado en cantidad de órdenes existentes
    const num    = String(orders.length + 1).padStart(4, '0');
    return `ORD-${num}-${ts.toString().slice(-5)}`;
}

// ── Helpers internos ───────────────────────────────────────────────────────────
function _getAllOrders() {
    return Storage.obtener(ORDERS_KEY, []);
}

function _saveAllOrders(orders) {
    Storage.guardar(ORDERS_KEY, orders);
}

// ── API PÚBLICA ────────────────────────────────────────────────────────────────

/**
 * Crea una orden nueva, descuenta stock y vacía el carrito.
 *
 * @param {{
 *   userId:        string,
 *   customerInfo:  { name:string, phone:string, address:string, city:string, notes?:string },
 *   items:         Array<{ productId:number|string, title:string, price:number, quantity:number, imagen:string }>,
 *   paymentMethod: 'nequi'|'bancolombia'|'contraentrega',
 * }} payload
 * @returns {Promise<{ ok:boolean, order?:object, error?:string }>}
 */
export async function crearOrden(payload) {
    const { userId, customerInfo, items, paymentMethod } = payload;

    // ── Validaciones ──────────────────────────────────────────────────────
    if (!items || items.length === 0) {
        return { ok: false, error: ORDER_ERRORS.EMPTY_CART };
    }
    if (!customerInfo?.name?.trim() ||
        !customerInfo?.phone?.trim() ||
        !customerInfo?.address?.trim() ||
        !customerInfo?.city?.trim()) {
        return { ok: false, error: ORDER_ERRORS.MISSING_FIELDS };
    }
    if (!['nequi', 'bancolombia', 'contraentrega'].includes(paymentMethod)) {
        return { ok: false, error: ORDER_ERRORS.MISSING_FIELDS };
    }

    // ── Verificar stock disponible ────────────────────────────────────────
    const productos = obtenerProductos();
    for (const item of items) {
        const prod = productos.find(p => String(p.id) === String(item.productId));
        if (prod && prod.stock < item.quantity) {
            return {
                ok:    false,
                error: ORDER_ERRORS.OUT_OF_STOCK,
                detalle: `Stock insuficiente para "${item.title}". Disponible: ${prod.stock}.`,
            };
        }
    }

    // ── Calcular precios ──────────────────────────────────────────────────
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping = SHIPPING_COST;
    const total    = subtotal + shipping;

    // ── Construir la orden ────────────────────────────────────────────────
    const now   = new Date().toISOString();
    const order = {
        id:           _generarOrderId(),
        userId:       userId ?? 'guest',
        customerInfo: {
            name:    customerInfo.name.trim(),
            phone:   customerInfo.phone.trim(),
            address: customerInfo.address.trim(),
            city:    customerInfo.city.trim(),
            notes:   customerInfo.notes?.trim() ?? '',
        },
        items: items.map(i => ({
            productId: String(i.productId),
            title:     i.title,
            price:     i.price,
            quantity:  i.quantity,
            imagen:    i.imagen ?? '',
        })),
        pricing: { subtotal, shipping, total },
        paymentMethod,
        status:    'pending',
        createdAt: now,
        updatedAt: now,
    };

    // ── Persistir la orden ────────────────────────────────────────────────
    const orders = _getAllOrders();
    _saveAllOrders([...orders, order]);

    // ── Descontar stock ───────────────────────────────────────────────────
    const productosActualizados = productos.map(prod => {
        const item = items.find(i => String(i.productId) === String(prod.id));
        if (!item) return prod;
        const nuevoStock = Math.max(0, prod.stock - item.quantity);
        return {
            ...prod,
            stock:    nuevoStock,
            etiqueta: nuevoStock === 0 ? 'agotado' : prod.etiqueta,
        };
    });
    guardarProductos(productosActualizados);

    // ── Vaciar carrito ────────────────────────────────────────────────────
    vaciarCarrito();

    // ── Limpiar snapshot del checkout ─────────────────────────────────────
    Storage.eliminar(STORAGE_KEYS.CHECKOUT);

    return { ok: true, order };
}

/**
 * Devuelve todas las órdenes del sistema.
 * @returns {Promise<object[]>}
 */
export async function obtenerTodasLasOrdenes() {
    return _getAllOrders();
}

/**
 * Devuelve las órdenes de un usuario específico.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function obtenerOrdenesPorUsuario(userId) {
    return _getAllOrders().filter(o => o.userId === userId);
}

/**
 * Devuelve una orden por su ID.
 * @param {string} orderId
 * @returns {Promise<{ ok:boolean, order?:object, error?:string }>}
 */
export async function obtenerOrdenPorId(orderId) {
    const order = _getAllOrders().find(o => o.id === orderId);
    if (!order) return { ok: false, error: ORDER_ERRORS.NOT_FOUND };
    return { ok: true, order };
}

/**
 * Actualiza el estado de una orden.
 * @param {string} orderId
 * @param {'pending'|'enviado'|'completado'|'cancelado'} nuevoEstado
 * @returns {Promise<{ ok:boolean, order?:object, error?:string }>}
 */
export async function actualizarEstadoOrden(orderId, nuevoEstado) {
    const orders = _getAllOrders();
    const idx    = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { ok: false, error: ORDER_ERRORS.NOT_FOUND };

    orders[idx] = {
        ...orders[idx],
        status:    nuevoEstado,
        updatedAt: new Date().toISOString(),
    };
    _saveAllOrders(orders);
    return { ok: true, order: orders[idx] };
}

/**
 * Guarda un snapshot del carrito actual antes de ir al checkout.
 * Permite recuperar los ítems si el usuario recarga la página.
 * @param {object[]} items
 */
export function guardarSnapshotCheckout(items) {
    Storage.guardar(STORAGE_KEYS.CHECKOUT, items);
}

/**
 * Recupera el snapshot guardado del checkout.
 * @returns {object[]|null}
 */
export function obtenerSnapshotCheckout() {
    return Storage.obtener(STORAGE_KEYS.CHECKOUT, null);
}
