// js/pages/pedidoExitoso.js
// ─────────────────────────────────────────────────────────────────────────────
// Pantalla de confirmación de pedido — Maye Mundo Belleza
//
// Flujo:
//  1. Lee el ID de la orden desde sessionStorage (guardado por checkout.js).
//  2. Recupera la orden completa desde maye_orders via orderService.
//  3. Rellena el ID visible, muestra instrucciones de pago según método.
//  4. Conecta botones: Descargar PDF, Imprimir, WhatsApp soporte.
// ─────────────────────────────────────────────────────────────────────────────

import { obtenerOrdenPorId }              from '../utils/orderService.js';
import { descargarFacturaPDF,
         imprimirFactura }                from '../utils/invoiceService.js';
import { waLink, RUTAS, EMPRESA }         from '../utils/constants.js';

// ── Labels de método de pago ──────────────────────────────────────────────────
const INSTRUCCIONES_PAGO = {
    nequi: `
        Transfiere el total de tu pedido a <strong>Nequi</strong>:<br>
        Número: <strong>+57 300 309 1641</strong> · Titular: <strong>${EMPRESA.NOMBRE}</strong><br>
        Envía el comprobante de pago por WhatsApp para confirmar tu despacho.`,

    bancolombia: `
        Realiza la transferencia a <strong>Bancolombia</strong>:<br>
        Cuenta de Ahorros: <strong>123-456789-00</strong> · Titular: <strong>${EMPRESA.NOMBRE}</strong><br>
        Cédula: <strong>1.234.567.890</strong><br>
        Envía el comprobante de pago por WhatsApp para confirmar tu despacho.`,

    contraentrega: `
        Tu pedido está confirmado con <strong>Pago Contraentrega</strong>.<br>
        Ten listo el valor <strong>exacto</strong> al momento de recibir.<br>
        Tiempo estimado de entrega: <strong>1 a 3 días hábiles</strong>.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────
export async function iniciarPedidoExitoso() {
    // ── Leer ID de la orden ───────────────────────────────────────────────
    const orderId = sessionStorage.getItem('maye_ultima_orden');

    if (!orderId) {
        // Sin orden → volver a la tienda
        window.location.replace(RUTAS.PRODUCTOS);
        return;
    }

    // ── Recuperar la orden ────────────────────────────────────────────────
    const resultado = await obtenerOrdenPorId(orderId);

    if (!resultado.ok) {
        document.getElementById('exito-orden-id').textContent = orderId;
        _renderInfoPago(null);
        _conectarBotonesBasicos(orderId, null);
        return;
    }

    const order = resultado.order;

    // ── Rellenar ID visible ───────────────────────────────────────────────
    const idEl = document.getElementById('exito-orden-id');
    if (idEl) idEl.textContent = order.id;

    // ── Instrucciones de pago ─────────────────────────────────────────────
    _renderInfoPago(order);

    // ── Conectar botones ──────────────────────────────────────────────────
    _conectarBotones(order);

    // ── Limpiar sessionStorage una vez mostrado ───────────────────────────
    // Lo dejamos durante la sesión del tab para permitir múltiples
    // descargas sin perder la referencia. Se limpia al salir de la página.
    window.addEventListener('pagehide', () => {
        sessionStorage.removeItem('maye_ultima_orden');
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER INFO DE PAGO
// ─────────────────────────────────────────────────────────────────────────────
function _renderInfoPago(order) {
    const el = document.getElementById('exito-info-pago');
    if (!el) return;

    if (!order) {
        el.innerHTML = 'Tu pedido fue registrado correctamente.';
        return;
    }

    const instrucciones = INSTRUCCIONES_PAGO[order.paymentMethod]
        ?? 'Tu pedido fue registrado. Nos pondremos en contacto para coordinar el pago.';

    el.innerHTML = instrucciones;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONECTAR BOTONES CON ORDEN
// ─────────────────────────────────────────────────────────────────────────────
function _conectarBotones(order) {
    // ── Descargar PDF ─────────────────────────────────────────────────────
    const btnPDF = document.getElementById('btn-descargar-pdf');
    if (btnPDF) {
        btnPDF.addEventListener('click', async () => {
            const textoOriginal = btnPDF.innerHTML;
            btnPDF.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 0.8s linear infinite"></i> Generando PDF...';
            btnPDF.disabled  = true;
            try {
                await descargarFacturaPDF(order);
            } catch (err) {
                console.error('[PedidoExitoso] Error al generar PDF:', err);
                alert('No se pudo generar el PDF. Intenta imprimir en su lugar.');
            } finally {
                btnPDF.innerHTML = textoOriginal;
                btnPDF.disabled  = false;
            }
        });
    }

    // ── Imprimir ──────────────────────────────────────────────────────────
    document.getElementById('btn-imprimir')
        ?.addEventListener('click', () => imprimirFactura(order));

    // ── WhatsApp soporte ──────────────────────────────────────────────────
    const btnWA = document.getElementById('btn-soporte-whatsapp');
    if (btnWA) {
        const msg = encodeURIComponent(
            `Hola ${EMPRESA.NOMBRE}! Acabo de realizar el pedido *${order.id}*.\n` +
            `Adjunto el comprobante de pago.\n` +
            `Método: ${order.paymentMethod}.\n` +
            `Total: $${order.pricing?.total?.toLocaleString('es-CO') ?? '—'}.\n\n` +
            `Quedo atento/a. ¡Gracias! 💚`
        );
        btnWA.href = waLink(msg);
    }
}

// Fallback cuando no se pudo recuperar la orden completa
function _conectarBotonesBasicos(orderId, _order) {
    const btnWA = document.getElementById('btn-soporte-whatsapp');
    if (btnWA) {
        const msg = encodeURIComponent(
            `Hola ${EMPRESA.NOMBRE}! Acabo de realizar el pedido *${orderId}*.\nQuedo atento/a.`
        );
        btnWA.href = waLink(msg);
    }

    // PDF e imprimir no disponibles sin la orden completa
    ['btn-descargar-pdf', 'btn-imprimir'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = true;
            btn.title    = 'Factura no disponible';
            btn.style.opacity = '0.45';
        }
    });
}
