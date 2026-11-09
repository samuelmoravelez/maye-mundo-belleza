// src/js/services/paymentService.js
// ─────────────────────────────────────────────────────────────────────────────
// Servicio de Pagos — Maye Mundo Belleza
//
// Funciones genéricas de persistencia de transacciones en Supabase.
// La pasarela anterior (Wompi) fue eliminada. Este módulo queda listo
// para integrar la nueva pasarela de pago.
//
// Funciones disponibles:
//   - registrarTransaccion()      → payment_transactions
//   - actualizarPaymentStatusOrden() → orders.payment_status
//   - obtenerTransacciones()      → lectura de payment_transactions
//   - registrarPagoManual()      → registra un pago manual pendiente
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient.js';

/** Estados en payment_transactions.status (ENUM payment_transaction_status) */
export const PAYMENT_STATUS = Object.freeze({
    PENDING:  'pending',
    APPROVED: 'approved',
    DECLINED: 'declined',
    ERROR:    'error',
    VOIDED:   'voided',
});

/** Estados en orders.payment_status (ENUM payment_status) */
export const ORDER_PAYMENT_STATUS = Object.freeze({
    PENDING:  'pending',
    PAID:     'paid',
    FAILED:   'failed',
    REFUNDED: 'refunded',
});

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCIA EN SUPABASE
// ─────────────────────────────────────────────────────────────────────────────

export async function registrarTransaccion({
    orderId,
    gateway,
    externalId     = null,
    amount,
    status         = PAYMENT_STATUS.PENDING,
    gatewayPayload = null,
}) {
    const { data, error } = await supabase
        .from('payment_transactions')
        .insert({
            order_id:     orderId,
            gateway,
            external_id:  externalId,
            amount,
            currency:     'COP',
            status,
            raw_response: gatewayPayload,
        })
        .select('*')
        .single();

    if (error) {
        console.error('[paymentService] registrarTransaccion:', error.message);
        return { ok: false, error: error.message };
    }

    return { ok: true, transaction: data };
}

export async function actualizarPaymentStatusOrden(orderId, paymentStatus) {
    const { error } = await supabase
        .from('orders')
        .update({ payment_status: paymentStatus })
        .eq('id', orderId);

    if (error) {
        console.error('[paymentService] actualizarPaymentStatusOrden:', error.message);
        return { ok: false, error: error.message };
    }
    return { ok: true };
}

export async function obtenerTransacciones(orderId) {
    const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[paymentService] obtenerTransacciones:', error.message);
        return [];
    }
    return data ?? [];
}

export async function registrarPagoManual(orderId, gateway, amount) {
    return registrarTransaccion({
        orderId,
        gateway,
        externalId:     null,
        amount,
        status:         PAYMENT_STATUS.PENDING,
        gatewayPayload: { tipo: 'pago_manual', registrado_en: new Date().toISOString() },
    });
}
