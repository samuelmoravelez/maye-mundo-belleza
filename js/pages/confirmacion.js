// js/pages/confirmacion.js
// ─────────────────────────────────────────────────────────────────────────────
// Pantalla de Confirmación de Pago — Mercado Pago Checkout Pro
// Maye Mundo Belleza
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../../src/js/services/supabaseClient.js';
import { obtenerOrdenPorId } from '../utils/orderService.js';
import { descargarFacturaPDF, imprimirFactura } from '../utils/invoiceService.js';
import { formatearPrecio } from '../data/productos.data.js';
import { waLink, EMPRESA, PAYMENT_SESSION_KEYS } from '../utils/constants.js';

export async function iniciarConfirmacionPago() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status') || params.get('collection_status') || 'success';
    const paymentId = params.get('payment_id') || params.get('collection_id') || '';
    const externalReference = params.get('external_reference') || '';
    const preferenceId = params.get('preference_id') || sessionStorage.getItem('maye_mp_preference_id') || '';

    let orderId = sessionStorage.getItem(PAYMENT_SESSION_KEYS.ULTIMA_ORDEN);
    let order = null;

    // 1. Si no hay orderId en sessionStorage, buscar la orden por external_reference (order_number)
    if (!orderId && externalReference) {
        const { data: foundOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('order_number', externalReference)
            .maybeSingle();

        if (foundOrder?.id) {
            orderId = foundOrder.id;
            sessionStorage.setItem(PAYMENT_SESSION_KEYS.ULTIMA_ORDEN, orderId);
        }
    }

    if (orderId) {
        const orderRes = await obtenerOrdenPorId(orderId);
        if (orderRes.ok) {
            order = orderRes.order;
        }
    }

    // 2. Si el pago fue aprobado, sincronizar con Supabase
    const isApproved = status === 'success' || status === 'approved';
    const isPending = status === 'pending';

    if (order && isApproved) {
        try {
            // Actualizar estado de pago en orders
            await supabase
                .from('orders')
                .update({ payment_status: 'paid' })
                .eq('id', order.id);

            // Actualizar transacción en payment_transactions
            if (paymentId) {
                await supabase
                    .from('payment_transactions')
                    .update({
                        status: 'approved',
                        external_id: paymentId,
                        raw_response: {
                            status,
                            payment_id: paymentId,
                            preference_id: preferenceId,
                            external_reference: externalReference,
                            updated_at: new Date().toISOString(),
                        },
                    })
                    .eq('order_id', order.id);
            }
        } catch (err) {
            console.error('[confirmacion] Error actualizando estado en Supabase:', err);
        }
    }

    // 3. Renderizar vista en base al estado
    _renderEncabezado(isApproved, isPending);
    _renderInfoMercadoPago({ paymentId, isApproved, isPending });

    if (order) {
        const orderNum = order.orderNumber || externalReference || order.id.slice(0, 8);
        const idEl = document.getElementById('exito-orden-id');
        if (idEl) idEl.textContent = String(orderNum).toUpperCase();

        _renderResumen(order);
        _conectarBotones(order, paymentId);
    } else {
        const idEl = document.getElementById('exito-orden-id');
        if (idEl) idEl.textContent = externalReference ? externalReference.toUpperCase() : 'MMB-PROCESADA';
        _renderFallback(externalReference, paymentId);
    }
}

function _renderEncabezado(isApproved, isPending) {
    const tituloEl = document.getElementById('confirmacion-titulo');
    const subtituloEl = document.getElementById('confirmacion-subtitulo');
    const iconoEl = document.getElementById('confirmacion-icono');

    if (isPending) {
        if (tituloEl) tituloEl.textContent = '¡Pago pendiente de acreditación!';
        if (subtituloEl) {
            subtituloEl.textContent = 'Mercado Pago está procesando tu pago. Tan pronto como sea acreditado, despacharemos tu pedido.';
        }
        if (iconoEl) {
            iconoEl.style.background = 'rgba(230, 162, 60, 0.15)';
            iconoEl.style.color = '#e6a23c';
            iconoEl.innerHTML = '<i class="ri-time-line"></i>';
        }
    } else if (isApproved) {
        if (tituloEl) tituloEl.textContent = '¡Pago confirmado con éxito!';
        if (subtituloEl) {
            subtituloEl.textContent = 'Tu pago ha sido validado correctamente mediante Mercado Pago. Hemos recibido tu pedido y está en preparación.';
        }
    }
}

function _renderInfoMercadoPago({ paymentId, isApproved, isPending }) {
    const el = document.getElementById('exito-info-pago');
    if (!el) return;

    const refPago = paymentId ? `<br>ID de Pago Mercado Pago: <strong>#${paymentId}</strong>` : '';
    const estadoTexto = isApproved
        ? '<strong style="color:var(--verde-principal)">Aprobado</strong>'
        : isPending
            ? '<strong style="color:#e6a23c">Pendiente de verificación</strong>'
            : 'En revisión';

    el.innerHTML = `
        <div style="font-size:0.88rem;line-height:1.6">
            Estado de la transacción: ${estadoTexto}
            ${refPago}
            <br>
            Pasarela: <strong>Mercado Pago Checkout Pro (Sandbox)</strong>
        </div>
    `;
}

function _renderResumen(order) {
    const el = document.getElementById('exito-resumen-pedido');
    if (!el) return;

    const itemsHTML = (order.items ?? []).map(item => {
        const titulo = item.title ?? item.nombre ?? 'Producto';
        const qty = item.quantity ?? item.cantidad ?? 1;
        const precio = item.price ?? item.precio ?? 0;
        const img = item.imagen || 'https://placehold.co/40x40/FAF7F2/2A8C64?text=Maye';

        return `
        <tr class="exito-resumen__fila">
            <td class="exito-resumen__td">
                <div style="display:flex;align-items:center;gap:10px">
                    <img src="${img}" alt="${_esc(titulo)}" class="exito-resumen__img"
                         onerror="this.src='https://placehold.co/40x40/FAF7F2/2A8C64?text=Maye'">
                    <div>
                        <span class="exito-resumen__item-nombre">${_esc(titulo)}</span>
                        <span class="exito-resumen__item-sku">${qty} unid. × ${formatearPrecio(precio)}</span>
                    </div>
                </div>
            </td>
            <td class="exito-resumen__td exito-resumen__td--derecha">
                <strong>${formatearPrecio(precio * qty)}</strong>
            </td>
        </tr>`;
    }).join('');

    const subtotal = order.pricing?.subtotal ?? 0;
    const shipping = order.pricing?.shipping ?? 0;
    const discount = order.pricing?.discount ?? 0;
    const total = order.pricing?.total ?? (subtotal + shipping - discount);

    const discountHTML = discount > 0 ? `
        <tr class="exito-resumen__fila exito-resumen__fila--total">
            <td class="exito-resumen__td" style="color:var(--verde-principal)">Descuento cupón</td>
            <td class="exito-resumen__td exito-resumen__td--derecha" style="color:var(--verde-principal)">
                -${formatearPrecio(discount)}
            </td>
        </tr>` : '';

    const shippingHTML = shipping === 0
        ? `<span style="color:var(--verde-principal);font-weight:700">¡Gratis!</span>`
        : formatearPrecio(shipping);

    el.innerHTML = `
        <table class="exito-resumen__tabla">
            <thead>
                <tr>
                    <th class="exito-resumen__th">Producto</th>
                    <th class="exito-resumen__th exito-resumen__th--derecha">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHTML}
            </tbody>
            <tfoot>
                <tr class="exito-resumen__fila exito-resumen__fila--total">
                    <td class="exito-resumen__td">Subtotal</td>
                    <td class="exito-resumen__td exito-resumen__td--derecha">${formatearPrecio(subtotal)}</td>
                </tr>
                <tr class="exito-resumen__fila exito-resumen__fila--total">
                    <td class="exito-resumen__td">Envío</td>
                    <td class="exito-resumen__td exito-resumen__td--derecha">${shippingHTML}</td>
                </tr>
                ${discountHTML}
                <tr class="exito-resumen__fila exito-resumen__fila--gran-total">
                    <td class="exito-resumen__td"><strong>TOTAL PAGADO</strong></td>
                    <td class="exito-resumen__td exito-resumen__td--derecha">
                        <strong style="color:var(--verde-principal);font-size:1.1rem">${formatearPrecio(total)}</strong>
                    </td>
                </tr>
            </tfoot>
        </table>

        <!-- Datos de Entrega -->
        <div style="margin-top:16px;padding:12px 16px;background:var(--fondo-crema);border-radius:var(--radio-md);font-size:0.83rem">
            <strong>Datos para la entrega:</strong><br>
            Destinatario: ${order.customerInfo?.name || 'Cliente'}<br>
            Teléfono: ${order.customerInfo?.phone || '—'}<br>
            Dirección: ${order.customerInfo?.address || '—'}, ${order.customerInfo?.city || ''}
        </div>
    `;
}

function _renderFallback(orderNumber, paymentId) {
    const el = document.getElementById('exito-resumen-pedido');
    if (!el) return;

    el.innerHTML = `
        <div style="padding:18px;background:var(--fondo-crema);border-radius:var(--radio-md);font-size:0.85rem;line-height:1.6">
            <strong>Detalles del pago registrado:</strong><br>
            Pedido: <strong>${orderNumber || 'Procesado'}</strong><br>
            Comprobante Mercado Pago: <strong>#${paymentId || 'Verificado'}</strong><br>
            <br>
            Hemos enviado la confirmación a tu correo electrónico. Si tienes dudas sobre tu pedido, contáctanos a través de WhatsApp.
        </div>
    `;
}

function _conectarBotones(order, paymentId) {
    const orderNum = order.orderNumber || order.id?.slice(0, 8) || '';

    // Botón descargar PDF
    document.getElementById('btn-descargar-pdf')?.addEventListener('click', () => {
        descargarFacturaPDF(order);
    });

    // Botón imprimir
    document.getElementById('btn-imprimir')?.addEventListener('click', () => {
        imprimirFactura(order);
    });

    // WhatsApp soporte
    const btnWa = document.getElementById('btn-soporte-whatsapp');
    if (btnWa) {
        const msg = encodeURIComponent(
            `Hola ${EMPRESA.NOMBRE}! Acabo de pagar mi pedido ${orderNum} por Mercado Pago (Pago #${paymentId || 'Sandbox'}). ¿Me confirman el despacho por favor?`
        );
        btnWa.href = waLink(msg);
    }
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
