// js/pages/pedidoExitoso.js
// ─────────────────────────────────────────────────────────────────────────────
// Pantalla de confirmación de pedido — Maye Mundo Belleza
//
// Flujo:
//  1. Lee orderId desde sessionStorage (previamente validado por el entry).
//  2. Recupera la orden completa desde maye_orders via orderService.
//  3. Rellena la cabecera: número de orden, fecha, estado.
//  4. Renderiza el resumen completo: cliente, dirección, productos, totales.
//  5. Muestra instrucciones de pago según el método elegido.
//  6. Conecta botones: Descargar PDF, Imprimir, WhatsApp soporte.
//     ⚠️  Las funciones descargarFacturaPDF e imprimirFactura de invoiceService.js
//         NO SE MODIFICAN — se conectan directamente al objeto orden.
// ─────────────────────────────────────────────────────────────────────────────

import { obtenerOrdenPorId }   from '../utils/orderService.js';
import { descargarFacturaPDF,
         imprimirFactura }     from '../utils/invoiceService.js';   // ← INTACTO
import { formatearPrecio }     from '../data/productos.data.js';
import { waLink, RUTAS,
         EMPRESA }             from '../utils/constants.js';

// ── Labels de métodos de pago ──────────────────────────────────────────────
const METODO_LABEL = {
    nequi:         'Nequi',
    bancolombia:   'Bancolombia / Transferencia',
    contraentrega: 'Pago Contraentrega (Efectivo)',
};

const METODO_INSTRUCCIONES = {
    nequi: `
        Transfiere el total a <strong>Nequi</strong>:<br>
        Número: <strong>+57 300 309 1641</strong>
        · Titular: <strong>${EMPRESA.NOMBRE}</strong><br>
        Envía el comprobante por WhatsApp para confirmar el despacho.`,

    bancolombia: `
        Realiza la transferencia a <strong>Bancolombia</strong>:<br>
        Cuenta de Ahorros: <strong>123-456789-00</strong>
        · Titular: <strong>${EMPRESA.NOMBRE}</strong><br>
        Cédula: <strong>1.234.567.890</strong><br>
        Envía el comprobante por WhatsApp para confirmar el despacho.`,

    contraentrega: `
        Tu pedido está confirmado con <strong>Pago Contraentrega</strong>.<br>
        Ten listo el valor <strong>exacto</strong> al recibir.<br>
        Tiempo estimado: <strong>1–3 días hábiles</strong>.`,
};

const ESTADO_LABEL = {
    pending:     'Pendiente',
    enviado:     'Enviado',
    completado:  'Completado',
    cancelado:   'Cancelado',
};

const ESTADO_CLS = {
    pending:    'exito-badge--amarillo',
    enviado:    'exito-badge--azul',
    completado: 'exito-badge--verde',
    cancelado:  'exito-badge--rojo',
};

// ── Formato fecha legible ─────────────────────────────────────────────────
function _fmtFecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export async function iniciarPedidoExitoso() {
    // El entry ya validó que el orderId existe → lo leemos de sessionStorage
    const orderId = sessionStorage.getItem('maye_ultima_orden');

    const resultado = await obtenerOrdenPorId(orderId);

    if (!resultado.ok) {
        // Fallback defensivo (el entry ya debería haberlo evitado)
        _renderFallback(orderId);
        return;
    }

    const order = resultado.order;

    // 1. Número de orden visible en el hero: preferir orderNumber (MMB-XXXXX)
    //    sobre el UUID interno de Supabase.
    const codigoVisible = order.orderNumber
        ? String(order.orderNumber).toUpperCase()
        : String(order.id).toUpperCase().slice(0, 8);
    const idEl = document.getElementById('exito-orden-id');
    if (idEl) idEl.textContent = codigoVisible;

    // 2. Instrucciones de pago
    _renderInfoPago(order);

    // 3. Resumen completo del pedido
    _renderResumenPedido(order);

    // 4. Conectar botones de acción (invoiceService intacto)
    _conectarBotones(order);

    // Limpiar sessionStorage al salir del tab (permite múltiples descargas)
    window.addEventListener('pagehide', () => {
        sessionStorage.removeItem('maye_ultima_orden');
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCCIONES DE PAGO
// ─────────────────────────────────────────────────────────────────────────────
function _renderInfoPago(order) {
    const el = document.getElementById('exito-info-pago');
    if (!el) return;
    const instrucciones = METODO_INSTRUCCIONES[order.paymentMethod]
        ?? 'Tu pedido fue registrado. Nos pondremos en contacto para coordinar el pago.';
    el.innerHTML = instrucciones;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN COMPLETO DEL PEDIDO
// ─────────────────────────────────────────────────────────────────────────────
function _renderResumenPedido(order) {
    const el = document.getElementById('exito-resumen-pedido');
    if (!el) return;

    const estado    = order.status ?? 'pending';
    const estadoLbl = ESTADO_LABEL[estado] ?? estado;
    const estadoCls = ESTADO_CLS[estado]   ?? 'exito-badge--gris';
    const metodo    = METODO_LABEL[order.paymentMethod] ?? order.paymentMethod;

    // ── Filas de productos ────────────────────────────────────────────────
    const itemsHTML = (order.items ?? []).map(item => {
        const titulo = item.title  ?? item.nombre ?? '—';
        const qty    = item.quantity ?? item.cantidad ?? 0;
        const precio = item.price    ?? item.precio  ?? 0;
        const img    = item.imagen   ?? '';
        return `
        <tr class="exito-resumen__fila">
            <td class="exito-resumen__td">
                <div style="display:flex;align-items:center;gap:10px">
                    <img src="${img || 'https://placehold.co/40x40/FAF7F2/2A8C64?text=Maye'}"
                         alt="${titulo}" class="exito-resumen__img"
                         onerror="this.src='https://placehold.co/40x40/FAF7F2/2A8C64?text=Maye'">
                    <span class="exito-resumen__nombre">${titulo}</span>
                </div>
            </td>
            <td class="exito-resumen__td exito-resumen__td--center">
                <span class="exito-resumen__qty">× ${qty}</span>
            </td>
            <td class="exito-resumen__td exito-resumen__td--right">
                <span class="exito-resumen__precio-unit">${formatearPrecio(precio)}</span>
            </td>
            <td class="exito-resumen__td exito-resumen__td--right">
                <strong class="exito-resumen__subtotal">${formatearPrecio(precio * qty)}</strong>
            </td>
        </tr>`;
    }).join('');

    // ── Totales ───────────────────────────────────────────────────────────
    const subtotal = order.pricing?.subtotal ?? 0;
    const shipping = order.pricing?.shipping ?? 0;
    const total    = order.pricing?.total    ?? subtotal + shipping;

    el.innerHTML = `
    <div class="exito-resumen__card">

        <!-- Cabecera del resumen -->
        <div class="exito-resumen__head">
            <div class="exito-resumen__head-left">
                <i class="ri-receipt-line" aria-hidden="true"></i>
                <span>Detalle del pedido</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
                <span class="exito-badge ${estadoCls}">${estadoLbl}</span>
                <span class="exito-resumen__fecha">${_fmtFecha(order.createdAt)}</span>
            </div>
        </div>

        <!-- Metadatos: cliente + dirección + pago -->
        <div class="exito-resumen__meta">
            <div class="exito-resumen__meta-bloque">
                <div class="exito-resumen__meta-titulo">
                    <i class="ri-user-3-line" aria-hidden="true"></i> Cliente
                </div>
                <div class="exito-resumen__meta-valor">
                    <strong>${order.customerInfo?.name ?? '—'}</strong><br>
                    <span>${order.customerInfo?.phone ?? '—'}</span>
                </div>
            </div>
            <div class="exito-resumen__meta-bloque">
                <div class="exito-resumen__meta-titulo">
                    <i class="ri-map-pin-line" aria-hidden="true"></i> Entrega
                </div>
                <div class="exito-resumen__meta-valor">
                    ${order.customerInfo?.address ?? '—'}<br>
                    <span>${order.customerInfo?.city ?? '—'}, Colombia</span>
                    ${order.customerInfo?.notes
                        ? `<br><em style="opacity:.7">${order.customerInfo.notes}</em>`
                        : ''}
                </div>
            </div>
            <div class="exito-resumen__meta-bloque">
                <div class="exito-resumen__meta-titulo">
                    <i class="ri-bank-card-line" aria-hidden="true"></i> Pago
                </div>
                <div class="exito-resumen__meta-valor">
                    <strong>${metodo}</strong>
                </div>
            </div>
        </div>

        <!-- Tabla de productos -->
        <div class="exito-resumen__tabla-wrap">
            <table class="exito-resumen__tabla" aria-label="Productos del pedido">
                <thead>
                    <tr>
                        <th class="exito-resumen__th">Producto</th>
                        <th class="exito-resumen__th exito-resumen__td--center">Cant.</th>
                        <th class="exito-resumen__th exito-resumen__td--right">Precio</th>
                        <th class="exito-resumen__th exito-resumen__td--right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
        </div>

        <!-- Totales -->
        <div class="exito-resumen__totales">
            <div class="exito-resumen__total-fila">
                <span>Subtotal</span>
                <span>${formatearPrecio(subtotal)}</span>
            </div>
            <div class="exito-resumen__total-fila">
                <span>Envío</span>
                <span style="color:var(--verde-principal);font-weight:600">
                    ${formatearPrecio(shipping)}
                </span>
            </div>
            <div class="exito-resumen__total-fila exito-resumen__total-fila--grande">
                <span>TOTAL PAGADO</span>
                <span>${formatearPrecio(total)}</span>
            </div>
        </div>

    </div><!-- /.exito-resumen__card -->`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTONES DE ACCIÓN — invoiceService INTACTO
// ─────────────────────────────────────────────────────────────────────────────
function _conectarBotones(order) {
    // ── Descargar PDF ─────────────────────────────────────────────────────
    // Llama directamente a descargarFacturaPDF(order) de invoiceService.js
    const btnPDF = document.getElementById('btn-descargar-pdf');
    if (btnPDF) {
        btnPDF.addEventListener('click', async () => {
            const textoOriginal = btnPDF.innerHTML;
            btnPDF.innerHTML = `
                <i class="ri-loader-4-line"
                   style="animation:spin 0.8s linear infinite;display:inline-block"></i>
                Generando PDF…`;
            btnPDF.disabled = true;
            try {
                await descargarFacturaPDF(order);   // ← invoiceService intacto
            } catch (err) {
                console.error('[Confirmación] Error al generar PDF:', err);
                alert('No se pudo generar el PDF. Usa el botón de imprimir.');
            } finally {
                btnPDF.innerHTML = textoOriginal;
                btnPDF.disabled  = false;
            }
        });
    }

    // ── Imprimir ──────────────────────────────────────────────────────────
    // Llama directamente a imprimirFactura(order) de invoiceService.js
    document.getElementById('btn-imprimir')
        ?.addEventListener('click', () => imprimirFactura(order));  // ← invoiceService intacto

    // ── WhatsApp soporte ──────────────────────────────────────────────────
    const btnWA = document.getElementById('btn-soporte-whatsapp');
    if (btnWA) {
        const codigoWA = order.orderNumber
            ? String(order.orderNumber).toUpperCase()
            : String(order.id).toUpperCase().slice(0, 8);
        const msg = encodeURIComponent(
            `Hola ${EMPRESA.NOMBRE}! 👋\n` +
            `Acabo de realizar el pedido *${codigoWA}*.\n` +
            `Método de pago: ${METODO_LABEL[order.paymentMethod] ?? order.paymentMethod}.\n` +
            `Total: ${formatearPrecio(order.pricing?.total ?? 0)}.\n\n` +
            `Adjunto el comprobante. ¡Gracias! 💚`
        );
        btnWA.href = waLink(msg);
    }

    // ── Dashboard "Ver mis pedidos" ───────────────────────────────────────
    const btnDash = document.getElementById('btn-ver-pedidos');
    if (btnDash) {
        btnDash.href = RUTAS.DASHBOARD;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK (no debería alcanzarse — el entry ya redirige)
// ─────────────────────────────────────────────────────────────────────────────
function _renderFallback(orderId) {
    const idEl = document.getElementById('exito-orden-id');
    if (idEl) idEl.textContent = orderId ?? '—';

    const infoPago = document.getElementById('exito-info-pago');
    if (infoPago) infoPago.textContent = 'Tu pedido fue registrado correctamente.';

    // Deshabilitar botones que requieren la orden completa
    ['btn-descargar-pdf', 'btn-imprimir'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) { btn.disabled = true; btn.style.opacity = '0.45'; }
    });

    // WhatsApp básico
    const btnWA = document.getElementById('btn-soporte-whatsapp');
    if (btnWA && orderId) {
        btnWA.href = waLink(encodeURIComponent(
            `Hola ${EMPRESA.NOMBRE}! Acabo de hacer el pedido *${orderId}*.`
        ));
    }
}
