// js/services/mercadoPagoService.js
// ─────────────────────────────────────────────────────────────────────────────
// Servicio de Integración con Mercado Pago Checkout Pro (Modo Sandbox)
// Maye Mundo Belleza
//
// Responsabilidades:
//  - Comunicarse con la API de Preferences de Mercado Pago
//    (https://api.mercadopago.com/checkout/preferences)
//  - Mapear ítems del carrito con title, quantity, unit_price y currency_id: 'COP'
//  - Calcular costo de envío usando la regla ENVIO_GRATIS_MINIMO ($120.000 COP)
//  - Configurar back_urls (success, failure, pending) y auto_return: 'approved'
//  - Entregar init_point y sandbox_init_point para redirección del comprador
// ─────────────────────────────────────────────────────────────────────────────

import {
    ENVIO_GRATIS_MINIMO,
    SHIPPING_COST,
    MERCADOPAGO_ACCESS_TOKEN,
} from '../utils/constants.js';

const MP_PREFERENCES_ENDPOINT = 'https://api.mercadopago.com/checkout/preferences';

/**
 * Calcula el costo de envío estándar según el subtotal de la compra.
 * @param {number} subtotal
 * @returns {number} 0 si supera o iguala ENVIO_GRATIS_MINIMO, de lo contrario SHIPPING_COST
 */
export function calcularCostoEnvio(subtotal) {
    return subtotal >= ENVIO_GRATIS_MINIMO ? 0 : SHIPPING_COST;
}

/**
 * Normaliza los ítems recibidos al formato estricto que exige la API de Mercado Pago.
 * @param {Array<Object>} items
 * @param {number} [discountAmount=0]
 * @returns {Array<Object>}
 */
function _formatearItemsParaMercadoPago(items, discountAmount = 0) {
    const mpItems = items.map(item => ({
        id: String(item.id || item.productId || ''),
        title: String(item.title || item.nombre || 'Producto Maye Mundo Belleza').trim(),
        quantity: Math.max(1, parseInt(item.quantity || item.cantidad || 1, 10)),
        unit_price: Math.max(0, parseFloat(item.unit_price || item.price || item.precio || 0)),
        currency_id: 'COP',
        picture_url: item.picture_url || item.imagen || undefined,
        description: item.description || undefined,
    }));

    // Si hay un descuento de cupón aplicado, se agrega como ítem de ajuste negativo
    if (discountAmount > 0) {
        mpItems.push({
            id: 'descuento-cupon',
            title: 'Descuento aplicado por cupón',
            quantity: 1,
            unit_price: -Math.abs(discountAmount),
            currency_id: 'COP',
        });
    }

    return mpItems;
}

/**
 * Genera una preferencia de pago en Mercado Pago Checkout Pro.
 *
 * @param {Object} params
 * @param {Array<Object>} params.items - Ítems del carrito
 * @param {number} [params.shippingCost] - Costo de envío explícito (si no se envía, se calcula automáticamente)
 * @param {string} params.orderNumber - Número de orden para rastreo (external_reference)
 * @param {Object} [params.customerInfo] - Información del cliente (nombre, email, teléfono, dirección)
 * @param {number} [params.discountAmount=0] - Monto de descuento de cupón
 * @returns {Promise<{ ok: boolean, preference?: Object, init_point?: string, sandbox_init_point?: string, error?: string }>}
 */
export async function crearPreferenciaMercadoPago({
    items = [],
    shippingCost,
    orderNumber,
    customerInfo = {},
    discountAmount = 0,
}) {
    if (!items.length) {
        return { ok: false, error: 'No hay productos en el carrito para procesar el pago.' };
    }

    // Calcular subtotal de productos
    const subtotal = items.reduce((acc, item) => {
        const precio = parseFloat(item.unit_price || item.price || item.precio || 0);
        const cant = parseInt(item.quantity || item.cantidad || 1, 10);
        return acc + (precio * cant);
    }, 0);

    // Calcular costo de envío según regla centralizada
    const costoEnvioReal = typeof shippingCost === 'number'
        ? shippingCost
        : calcularCostoEnvio(subtotal);

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

    // ── Construir payload de la preferencia ─────────────────────────────────
    const payload = {
        items: _formatearItemsParaMercadoPago(items, discountAmount),
        shipments: {
            cost: costoEnvioReal,
            mode: 'not_specified',
        },
        back_urls: {
            success: `${origin}/confirmacion.html?status=success`,
            failure: `${origin}/checkout.html?status=failure`,
            pending: `${origin}/confirmacion.html?status=pending`,
        },
        auto_return: 'approved',
        external_reference: String(orderNumber || '').trim(),
        statement_descriptor: 'MAYE BELLEZA',
        binary_mode: false,
    };

    // Agregar datos de pagador si están disponibles
    if (customerInfo.name || customerInfo.email || customerInfo.phone) {
        payload.payer = {
            name: customerInfo.name ? String(customerInfo.name).trim() : undefined,
            email: customerInfo.email ? String(customerInfo.email).trim() : undefined,
            phone: customerInfo.phone ? {
                number: String(customerInfo.phone).replace(/\D/g, '') || undefined,
            } : undefined,
            address: customerInfo.address ? {
                street_name: String(customerInfo.address).trim(),
            } : undefined,
        };
    }

    const token = MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
        console.error('[mercadoPagoService] Token de acceso no configurado.');
        return { ok: false, error: 'Credenciales de Mercado Pago no configuradas en el entorno.' };
    }

    try {
        let response = await fetch(MP_PREFERENCES_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        let data = await response.json();

        // Tolerancia a entornos locales HTTP: si Mercado Pago rechaza auto_return
        // debido a que el origen local no usa HTTPS, reintentar sin auto_return.
        if (!response.ok && data?.error === 'invalid_auto_return') {
            console.warn('[mercadoPagoService] auto_return no admitido en origen HTTP no-seguro. Reintentando sin auto_return...');
            delete payload.auto_return;

            response = await fetch(MP_PREFERENCES_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            data = await response.json();
        }

        if (!response.ok) {
            console.error('[mercadoPagoService] Error en respuesta de Mercado Pago:', data);
            const mensajeError = data?.message || data?.error || 'Error al comunicarse con Mercado Pago.';
            return { ok: false, error: mensajeError, details: data };
        }

        return {
            ok: true,
            preference: data,
            id: data.id,
            init_point: data.init_point,
            sandbox_init_point: data.sandbox_init_point,
        };
    } catch (err) {
        console.error('[mercadoPagoService] Excepción de red al crear preferencia:', err);
        return {
            ok: false,
            error: 'No se pudo conectar con Mercado Pago. Verifica tu conexión a internet.',
        };
    }
}
