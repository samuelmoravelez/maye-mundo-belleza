// src/js/services/orderService.js

import Storage from '../../../js/utils/storage.js';
import { STORAGE_KEYS, SHIPPING_COST } from '../../../js/utils/constants.js';
import { supabase } from './supabaseClient.js';
import { getSession, isLoggedIn } from './authService.js';
import { ensureProductosLoaded } from './productService.js';
import { vaciarCarrito } from './cartService.js';
import { registrarUsoCupon } from './couponService.js';

export const ORDER_ERRORS = Object.freeze({
    EMPTY_CART:     'EMPTY_CART',
    MISSING_FIELDS: 'MISSING_FIELDS',
    OUT_OF_STOCK:   'OUT_OF_STOCK',
    NOT_FOUND:      'NOT_FOUND',
    FORBIDDEN:      'FORBIDDEN',
    AUTH_REQUIRED:  'AUTH_REQUIRED',
});

const PAYMENT_TO_DB = {
    nequi:        'Nequi',
    bancolombia:  'Bancolombia',
    contraentrega:'Web_Simulado',
    whatsapp:     'WhatsApp',
};

const STATUS_TO_FRONT = {
    PENDIENTE:  'pending',
    PAGADO:     'pending',
    ENVIADO:    'enviado',
    ENTREGADO:  'completado',
    CANCELADO:  'cancelado',
};

const STATUS_TO_DB = {
    pending:    'PENDIENTE',
    enviado:    'ENVIADO',
    completado: 'ENTREGADO',
    cancelado:  'CANCELADO',
};

/**
 * Obtiene el siguiente número de pedido secuencial desde Supabase.
 *
 * Estrategia de dos capas para garantizar unicidad y tolerancia a fallos:
 *
 * 1. PRIMARIA — RPC `next_order_sequence`:
 *    Llama a una función PostgreSQL que ejecuta:
 *      SELECT nextval('order_sequence') AS seq
 *    Esto es atómico: dos llamadas concurrentes nunca devuelven el mismo valor.
 *    El resultado se formatea como MMB-00001, MMB-00002, …
 *
 * 2. FALLBACK — MAX(order_number) + 1:
 *    Si la RPC no existe todavía en Supabase (proyecto en migración), cuenta
 *    las filas existentes con prefijo MMB- y genera el siguiente número.
 *    NO es 100% seguro bajo concurrencia extrema, pero es aceptable como
 *    transición hasta que se cree la secuencia en la base de datos.
 *
 * SQL para crear la secuencia (ejecutar UNA VEZ en el editor SQL de Supabase):
 * ─────────────────────────────────────────────────────────────────────────────
 * -- 1. Crear la secuencia empezando desde 1
 * CREATE SEQUENCE IF NOT EXISTS order_sequence START 1;
 *
 * -- 2. Si ya hay pedidos, sincronizar el inicio con el último número MMB-
 * --    (ejecutar solo si hay datos previos):
 * SELECT setval(
 *   'order_sequence',
 *   COALESCE(
 *     (SELECT MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER))
 *      FROM orders WHERE order_number LIKE 'MMB-%'),
 *     0
 *   ) + 1,
 *   false   -- false = el próximo nextval() devolverá este valor
 * );
 *
 * -- 3. Crear la función RPC que el cliente llama
 * CREATE OR REPLACE FUNCTION next_order_sequence()
 * RETURNS TABLE(seq bigint)
 * LANGUAGE sql SECURITY DEFINER AS $$
 *   SELECT nextval('order_sequence') AS seq;
 * $$;
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @returns {Promise<string>} Ej: "MMB-00001"
 */
async function _generarOrderNumber() {
    const PREFIX  = 'MMB';
    const PADDING = 5; // dígitos: MMB-00001 … MMB-99999

    // ── Capa 1: RPC atómica (fuente de verdad en producción) ──────────────
    try {
        const { data, error } = await supabase.rpc('next_order_sequence');
        if (!error && data != null) {
            const seq = Array.isArray(data) ? data[0]?.seq : data?.seq ?? data;
            if (seq != null && !isNaN(Number(seq))) {
                return `${PREFIX}-${String(Number(seq)).padStart(PADDING, '0')}`;
            }
        }
        if (error) {
            console.warn('[orderService] next_order_sequence RPC no disponible, usando fallback:', error.message);
        }
    } catch (rpcErr) {
        console.warn('[orderService] RPC error:', rpcErr.message);
    }

    // ── Capa 2: Fallback — MAX existente + 1 ─────────────────────────────
    // Busca el número MMB- más alto en la tabla y suma 1.
    // Se usa ILIKE para que sea case-insensitive y robusto.
    try {
        const { data: rows, error: qErr } = await supabase
            .from('orders')
            .select('order_number')
            .ilike('order_number', `${PREFIX}-%`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (!qErr && rows?.length > 0) {
            const lastNum = rows[0].order_number;
            // Extraer la parte numérica: "MMB-00042" → 42
            const parts = lastNum.split('-');
            const lastSeq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastSeq)) {
                return `${PREFIX}-${String(lastSeq + 1).padStart(PADDING, '0')}`;
            }
        }
    } catch (fbErr) {
        console.warn('[orderService] fallback query error:', fbErr.message);
    }

    // ── Capa 3: Emergencia — timestamp compacto (nunca debería llegar aquí)
    const emergency = Date.now().toString().slice(-PADDING);
    return `${PREFIX}-${emergency}`;
}

function _mapOrderRow(row, items = []) {
    const shipping = Number(row.shipping_cost ?? SHIPPING_COST);
    const subtotal = Number(row.subtotal ?? 0);
    const total = Number(row.total ?? subtotal + shipping);
    return {
        id: row.id,
        orderNumber: row.order_number,
        userId: row.user_id,
        customerInfo: {
            name:    row.customer_name,
            phone:   row.customer_phone,
            address: row.shipping_snapshot?.address_line ?? row.shipping_snapshot?.address ?? '',
            city:    row.shipping_snapshot?.city ?? '',
            notes:   row.notes ?? '',
        },
        items: items.map(i => ({
            productId: String(i.product_id ?? ''),
            title:     i.product_name,
            price:     Number(i.unit_price),
            quantity:  i.quantity,
            imagen:    i.image_url ?? '',
        })),
        pricing: {
            subtotal,
            shipping,
            discount: Number(row.discount_amount ?? 0),
            total,
        },
        paymentMethod: _paymentFromDb(row.payment_method),
        status: STATUS_TO_FRONT[row.status] ?? 'pending',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function _paymentFromDb(method) {
    const entry = Object.entries(PAYMENT_TO_DB).find(([, v]) => v === method);
    return entry?.[0] ?? 'nequi';
}

async function _fetchOrderItems(orderId) {
    const { data } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
    return data ?? [];
}

export async function crearOrden(payload) {
    const { userId, customerInfo, items, paymentMethod, couponCode, discountAmount = 0, couponId = null } = payload;

    if (!isLoggedIn() || !userId || userId === 'guest') {
        return { ok: false, error: ORDER_ERRORS.AUTH_REQUIRED };
    }

    if (!items?.length) {
        return { ok: false, error: ORDER_ERRORS.EMPTY_CART };
    }
    if (!customerInfo?.name?.trim() ||
        !customerInfo?.phone?.trim() ||
        !customerInfo?.address?.trim() ||
        !customerInfo?.city?.trim()) {
        return { ok: false, error: ORDER_ERRORS.MISSING_FIELDS };
    }
    if (!PAYMENT_TO_DB[paymentMethod]) {
        return { ok: false, error: ORDER_ERRORS.MISSING_FIELDS };
    }

    await ensureProductosLoaded();
    const { data: products } = await supabase
        .from('products')
        .select('id, name, stock_quantity, sku')
        .in('id', items.map(i => i.productId));

    const stockMap = new Map((products ?? []).map(p => [String(p.id), p]));

    for (const item of items) {
        const prod = stockMap.get(String(item.productId));
        if (prod && prod.stock_quantity < item.quantity) {
            return {
                ok: false,
                error: ORDER_ERRORS.OUT_OF_STOCK,
                detalle: `Stock insuficiente para "${item.title}". Disponible: ${prod.stock_quantity}.`,
            };
        }
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping = SHIPPING_COST;
    const discount = Number(discountAmount) || 0;
    const total = Math.max(subtotal + shipping - discount, 1);

    const session = getSession();
    const orderNumber = await _generarOrderNumber();
    const shippingSnapshot = {
        recipient_name: customerInfo.name.trim(),
        phone: customerInfo.phone.trim(),
        address_line: customerInfo.address.trim(),
        city: customerInfo.city.trim(),
    };

    const { data: orderRow, error: orderErr } = await supabase
        .from('orders')
        .insert({
            order_number: orderNumber,
            user_id: session.id,
            status: 'PENDIENTE',
            subtotal,
            shipping_cost: shipping,
            discount_amount: discount,
            total,
            coupon_id: couponId,
            payment_method: PAYMENT_TO_DB[paymentMethod],
            payment_status: 'pending',
            shipping_snapshot: shippingSnapshot,
            customer_name: customerInfo.name.trim(),
            customer_phone: customerInfo.phone.trim(),
            customer_email: session.email ?? null,
            notes: customerInfo.notes?.trim() ?? '',
        })
        .select('*')
        .single();

    if (orderErr || !orderRow) {
        console.error('[orderService]', orderErr?.message);
        return { ok: false, error: ORDER_ERRORS.FORBIDDEN };
    }

    const orderItems = items.map(i => ({
        order_id: orderRow.id,
        product_id: i.productId,
        product_name: i.title,
        product_sku: stockMap.get(String(i.productId))?.sku ?? null,
        unit_price: i.price,
        quantity: i.quantity,
        line_total: i.price * i.quantity,
        image_url: i.imagen ?? '',
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
    if (itemsErr) {
        console.error('[orderService] items:', itemsErr.message);
        return { ok: false, error: ORDER_ERRORS.FORBIDDEN };
    }

    const stockPayload = items.map(i => ({
        product_id: Number(i.productId),
        quantity: i.quantity,
    }));
    await supabase.rpc('apply_order_stock_deduction', { p_items: stockPayload });

    if (couponCode) {
        await registrarUsoCupon(couponCode, orderRow.id, discount);
    }

    await vaciarCarrito();
    Storage.eliminar(STORAGE_KEYS.CHECKOUT);

    const order = _mapOrderRow(orderRow, orderItems);
    return { ok: true, order };
}

export async function obtenerTodasLasOrdenes() {
    if (!isAdmin()) {
        const session = getSession();
        if (!session) return [];
        return obtenerOrdenesPorUsuario(session.id);
    }

    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[orderService]', error.message);
        return [];
    }

    const orders = [];
    for (const row of data ?? []) {
        const items = await _fetchOrderItems(row.id);
        orders.push(_mapOrderRow(row, items));
    }
    return orders;
}

function isAdmin() {
    return getSession()?.role === 'admin';
}

export async function obtenerOrdenesPorUsuario(userId) {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[orderService]', error.message);
        return [];
    }

    const orders = [];
    for (const row of data ?? []) {
        const items = await _fetchOrderItems(row.id);
        orders.push(_mapOrderRow(row, items));
    }
    return orders;
}

export async function obtenerOrdenPorId(orderId) {
    const { data: row, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

    if (error || !row) return { ok: false, error: ORDER_ERRORS.NOT_FOUND };
    const items = await _fetchOrderItems(orderId);
    return { ok: true, order: _mapOrderRow(row, items) };
}

export async function actualizarEstadoOrden(orderId, nuevoEstado) {
    const dbStatus = STATUS_TO_DB[nuevoEstado];
    if (!dbStatus) return { ok: false, error: ORDER_ERRORS.NOT_FOUND };

    const { data, error } = await supabase
        .from('orders')
        .update({ status: dbStatus })
        .eq('id', orderId)
        .select('*')
        .maybeSingle();

    if (error || !data) return { ok: false, error: ORDER_ERRORS.NOT_FOUND };
    const items = await _fetchOrderItems(orderId);
    return { ok: true, order: _mapOrderRow(data, items) };
}

export function guardarSnapshotCheckout(items) {
    Storage.guardar(STORAGE_KEYS.CHECKOUT, items);
}

export function obtenerSnapshotCheckout() {
    return Storage.obtener(STORAGE_KEYS.CHECKOUT, null);
}
