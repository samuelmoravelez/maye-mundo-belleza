// js/utils/invoiceService.js
// ─────────────────────────────────────────────────────────────────────────────
// Servicio de Facturación — Maye Mundo Belleza
//
// Responsabilidades:
//   - Generar el HTML de la factura/comprobante de compra.
//   - Mostrar el código secuencial (MMB-00001) como número de pedido oficial.
//   - Disparar descarga en PDF vía html2canvas + jsPDF (lazy load desde CDN).
//   - Exponer impresión optimizada con @media print.
//
// USO:
//   import { descargarFacturaPDF, imprimirFactura } from './invoiceService.js';
//   await descargarFacturaPDF(order);
// ─────────────────────────────────────────────────────────────────────────────

import { EMPRESA } from './constants.js';
import { formatearPrecio } from '../data/productos.data.js';

// ── Labels ────────────────────────────────────────────────────────────────────
const METODO_LABEL = {
    nequi:         'Nequi',
    bancolombia:   'Bancolombia PSE / Transferencia',
    contraentrega: 'Pago Contraentrega (Efectivo)',
};

const ESTADO_LABEL = {
    pending:    'Pendiente de pago',
    enviado:    'Enviado',
    completado: 'Completado',
    cancelado:  'Cancelado',
};

const ESTADO_COLOR = {
    pending:    '#f97316',
    enviado:    '#3b82f6',
    completado: '#2A8C64',
    cancelado:  '#ef4444',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtFecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

/**
 * Resuelve el código visible del pedido.
 * Prioridad: order.orderNumber (MMB-XXXXX) → order.id (UUID) → '—'
 * Garantiza que la factura siempre muestre el consecutivo secuencial
 * cuando esté disponible, y nunca quede en blanco.
 */
function _resolverCodigoPedido(order) {
    if (order.orderNumber && String(order.orderNumber).trim()) {
        return String(order.orderNumber).trim().toUpperCase();
    }
    // Fallback: UUID recortado (primeros 8 chars) para legibilidad mínima
    if (order.id) return String(order.id).toUpperCase().slice(0, 8);
    return '—';
}

// ── Generador del HTML de la factura ─────────────────────────────────────────

/**
 * Genera el HTML completo de la factura para una orden.
 * Autocontenido (estilos inline) para compatibilidad con html2canvas y print.
 *
 * @param {object} order - Orden normalizada de orderService.js
 * @returns {string} HTML string
 */
export function generarHTMLFactura(order) {
    const codigoPedido = _resolverCodigoPedido(order);
    const estadoColor  = ESTADO_COLOR[order.status] ?? '#6b7280';
    const metodoPago   = METODO_LABEL[order.paymentMethod] ?? order.paymentMethod;
    const estadoLabel  = ESTADO_LABEL[order.status]        ?? order.status;

    const filasItems = (order.items ?? []).map(item => `
        <tr>
            <td style="padding:11px 14px;border-bottom:1px solid #f0f0f0;
                       font-size:0.875rem;color:#374151;vertical-align:middle">
                <div style="font-weight:600;color:#1f2937;margin-bottom:2px">${item.title}</div>
                ${item.productId ? `<div style="font-size:0.72rem;color:#9ca3af">Ref: ${item.productId}</div>` : ''}
            </td>
            <td style="padding:11px 14px;border-bottom:1px solid #f0f0f0;
                       text-align:center;font-size:0.875rem;color:#374151">
                <span style="display:inline-block;background:#f3f4f6;border-radius:20px;
                             padding:2px 10px;font-weight:700;font-size:0.8rem">
                    ${item.quantity}
                </span>
            </td>
            <td style="padding:11px 14px;border-bottom:1px solid #f0f0f0;
                       text-align:right;font-size:0.875rem;color:#6b7280">
                ${formatearPrecio(item.price)}
            </td>
            <td style="padding:11px 14px;border-bottom:1px solid #f0f0f0;
                       text-align:right;font-weight:700;font-size:0.9rem;color:#1C3F2D">
                ${formatearPrecio(item.price * item.quantity)}
            </td>
        </tr>`).join('');

    const descuentoFila = (order.pricing?.discount > 0) ? `
        <div style="display:flex;justify-content:space-between;
                    font-size:0.85rem;color:#2A8C64;padding:4px 0;font-weight:600">
            <span>Descuento aplicado</span>
            <span>− ${formatearPrecio(order.pricing.discount)}</span>
        </div>` : '';

    return /* html */`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Pedido ${codigoPedido} — ${EMPRESA.NOMBRE}</title>
    <style>
        *  { box-sizing:border-box; margin:0; padding:0; }
        body {
            font-family:'Segoe UI',Arial,sans-serif;
            background:#f0f2f5;
            color:#1f2937;
            -webkit-print-color-adjust:exact;
            print-color-adjust:exact;
        }
        .factura {
            background:#fff;
            max-width:780px;
            margin:32px auto;
            border-radius:14px;
            box-shadow:0 8px 40px rgba(0,0,0,0.12);
            overflow:hidden;
        }

        /* ── Encabezado bicolor ── */
        .factura__header {
            background:linear-gradient(135deg,#1C3F2D 0%,#2A8C64 100%);
            padding:32px 40px 28px;
        }
        .factura__header-top {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:20px;
            margin-bottom:24px;
        }
        .factura__logo-wrap { display:flex;align-items:center;gap:14px; }
        .factura__logo {
            width:54px;height:54px;
            border-radius:50%;
            border:2px solid rgba(255,255,255,0.3);
            background:rgba(255,255,255,0.12);
        }
        .factura__empresa-nombre {
            font-size:1.2rem;font-weight:800;
            color:#fff;letter-spacing:0.01em;
        }
        .factura__empresa-sub {
            font-size:0.73rem;
            color:rgba(255,255,255,0.72);
            margin-top:3px;
        }
        .factura__num-wrap { text-align:right; }
        .factura__tipo-doc {
            font-size:0.65rem;text-transform:uppercase;
            letter-spacing:0.12em;color:rgba(255,255,255,0.55);
            font-weight:700;
        }

        /* ── Número de pedido — protagonista visual ── */
        .factura__num {
            font-size:1.65rem;font-weight:900;
            color:#fff;margin-top:4px;
            letter-spacing:0.04em;
            font-variant-numeric:tabular-nums;
            text-shadow:0 2px 8px rgba(0,0,0,0.25);
        }
        .factura__num-acento {
            color:#b8f0d8;     /* verde muy claro para el prefijo MMB- */
        }
        .factura__fecha { font-size:0.73rem;color:rgba(255,255,255,0.65);margin-top:6px; }

        /* ── Divider con badge de estado ── */
        .factura__header-footer {
            border-top:1px solid rgba(255,255,255,0.15);
            padding-top:14px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            flex-wrap:wrap;
            gap:8px;
        }
        .factura__estado-badge {
            display:inline-flex;align-items:center;gap:6px;
            padding:5px 16px;
            border-radius:50px;
            font-size:0.72rem;font-weight:800;
            text-transform:uppercase;letter-spacing:0.08em;
            color:#fff;
        }
        .factura__estado-dot {
            width:7px;height:7px;border-radius:50%;
            background:rgba(255,255,255,0.7);flex-shrink:0;
        }
        .factura__qr-hint {
            font-size:0.7rem;color:rgba(255,255,255,0.5);
            font-style:italic;
        }

        /* ── Cuerpo ── */
        .factura__body { padding:32px 40px; }

        /* ── Dos columnas: cliente + envío ── */
        .factura__dos-col {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:20px;
            margin-bottom:28px;
            background:#fafafa;
            border:1px solid #f0f0f0;
            border-radius:10px;
            padding:18px 20px;
        }
        .factura__bloque-titulo {
            font-size:0.62rem;text-transform:uppercase;
            letter-spacing:0.12em;color:#9ca3af;
            font-weight:700;margin-bottom:8px;
        }
        .factura__bloque-valor {
            font-size:0.875rem;color:#374151;line-height:1.75;
        }
        .factura__bloque-valor strong { color:#1f2937; }

        /* ── Tabla de productos ── */
        .factura__tabla {
            width:100%;border-collapse:collapse;margin-bottom:8px;
        }
        .factura__tabla thead tr {
            background:linear-gradient(90deg,#f8f9fa,#f0f2f5);
        }
        .factura__tabla th {
            padding:10px 14px;
            text-align:left;
            font-size:0.68rem;text-transform:uppercase;
            letter-spacing:0.1em;color:#9ca3af;font-weight:800;
            border-bottom:2px solid #e5e7eb;
        }
        .factura__tabla th:nth-child(n+2) { text-align:center; }
        .factura__tabla th:last-child { text-align:right; }
        .factura__tabla tbody tr:last-child td { border-bottom:none; }

        /* ── Totales ── */
        .factura__totales-wrap {
            display:flex;
            justify-content:flex-end;
            margin-top:16px;
        }
        .factura__totales {
            width:280px;
            border:1px solid #f0f0f0;
            border-radius:10px;
            padding:16px 18px;
            background:#fafafa;
        }
        .factura__totales-fila {
            display:flex;justify-content:space-between;
            font-size:0.85rem;color:#6b7280;padding:5px 0;
        }
        .factura__totales-sep {
            height:1px;background:#e5e7eb;margin:8px 0;
        }
        .factura__totales-fila--total {
            font-size:1.05rem;font-weight:800;color:#1f2937;
            padding-top:6px;
        }
        .factura__totales-fila--total span:last-child { color:#2A8C64; }

        /* ── Método de pago ── */
        .factura__pago {
            margin-top:20px;
            background:linear-gradient(90deg,rgba(42,140,100,0.06),rgba(42,140,100,0.02));
            border:1px solid rgba(42,140,100,0.15);
            border-radius:10px;
            padding:14px 16px;
            display:flex;align-items:center;gap:12px;
            font-size:0.875rem;color:#374151;
        }
        .factura__pago-icon {
            width:36px;height:36px;
            background:rgba(42,140,100,0.12);
            border-radius:8px;
            display:flex;align-items:center;justify-content:center;
            font-size:1.1rem;color:#2A8C64;flex-shrink:0;
        }

        /* ── Sello "Generado por" ── */
        .factura__sello {
            margin-top:20px;
            text-align:center;
            font-size:0.7rem;
            color:#d1d5db;
            letter-spacing:0.04em;
        }

        /* ── Footer ── */
        .factura__footer {
            background:linear-gradient(90deg,#fafafa,#f5f5f5);
            border-top:1px solid #e5e7eb;
            padding:18px 40px;
            display:flex;justify-content:space-between;
            align-items:center;flex-wrap:wrap;gap:10px;
        }
        .factura__footer-txt { font-size:0.73rem;color:#9ca3af; }
        .factura__footer-marca {
            font-size:0.82rem;font-weight:800;color:#2A8C64;
            letter-spacing:0.02em;
        }

        /* ── @media print ── */
        @media print {
            body { background:#fff; }
            .factura {
                box-shadow:none;margin:0;
                border-radius:0;max-width:100%;
            }
            .no-print { display:none !important; }
        }
    </style>
</head>
<body>
<div class="factura" id="factura-root">

    <!-- ── Encabezado ── -->
    <div class="factura__header">
        <div class="factura__header-top">

            <div class="factura__logo-wrap">
                <img src="https://res.cloudinary.com/ocnnxclz/image/upload/v1784219028/333_mvofgw.png"
                     alt="${EMPRESA.NOMBRE}" class="factura__logo">
                <div>
                    <div class="factura__empresa-nombre">${EMPRESA.NOMBRE}</div>
                    <div class="factura__empresa-sub">
                        ${EMPRESA.UBICACION}&nbsp;|&nbsp;${EMPRESA.TELEFONO}
                    </div>
                    <div class="factura__empresa-sub">${EMPRESA.EMAIL}</div>
                </div>
            </div>

            <div class="factura__num-wrap">
                <div class="factura__tipo-doc">Comprobante de Compra</div>
                <div class="factura__num">
                    <!-- Prefijo en verde claro para diferenciarlo del consecutivo -->
                    <span class="factura__num-acento">${codigoPedido.includes('-') ? codigoPedido.split('-')[0] + '-' : ''}</span>${codigoPedido.includes('-') ? codigoPedido.split('-').slice(1).join('-') : codigoPedido}
                </div>
                <div class="factura__fecha">📅 ${fmtFecha(order.createdAt)}</div>
            </div>

        </div>

        <div class="factura__header-footer">
            <span class="factura__estado-badge"
                  style="background:${estadoColor}">
                <span class="factura__estado-dot"></span>
                ${estadoLabel}
            </span>
            <span class="factura__qr-hint">
                N.° de pedido oficial: ${codigoPedido}
            </span>
        </div>
    </div>

    <!-- ── Cuerpo ── -->
    <div class="factura__body">

        <!-- Datos cliente + envío -->
        <div class="factura__dos-col">
            <div>
                <div class="factura__bloque-titulo">👤 Datos del cliente</div>
                <div class="factura__bloque-valor">
                    <strong>${order.customerInfo?.name ?? '—'}</strong><br>
                    📞 ${order.customerInfo?.phone ?? '—'}<br>
                    ${order.customerInfo?.notes
                        ? `💬 ${order.customerInfo.notes}`
                        : ''}
                </div>
            </div>
            <div>
                <div class="factura__bloque-titulo">📦 Dirección de entrega</div>
                <div class="factura__bloque-valor">
                    ${order.customerInfo?.address ?? '—'}<br>
                    ${order.customerInfo?.city ?? '—'}, Colombia
                </div>
            </div>
        </div>

        <!-- Tabla de productos -->
        <table class="factura__tabla">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th style="text-align:center">Cant.</th>
                    <th style="text-align:right">Precio unit.</th>
                    <th style="text-align:right">Subtotal</th>
                </tr>
            </thead>
            <tbody>${filasItems}</tbody>
        </table>

        <!-- Totales -->
        <div class="factura__totales-wrap">
            <div class="factura__totales">
                <div class="factura__totales-fila">
                    <span>Subtotal productos</span>
                    <span>${formatearPrecio(order.pricing?.subtotal ?? 0)}</span>
                </div>
                <div class="factura__totales-fila">
                    <span>Envío estándar</span>
                    <span>${formatearPrecio(order.pricing?.shipping ?? 0)}</span>
                </div>
                ${descuentoFila}
                <div class="factura__totales-sep"></div>
                <div class="factura__totales-fila factura__totales-fila--total">
                    <span>TOTAL</span>
                    <span>${formatearPrecio(order.pricing?.total ?? 0)}</span>
                </div>
            </div>
        </div>

        <!-- Método de pago -->
        <div class="factura__pago">
            <div class="factura__pago-icon">💳</div>
            <div>
                <strong>Método de pago:</strong>&nbsp;${metodoPago}
            </div>
        </div>

        <!-- Sello -->
        <div class="factura__sello">
            Documento generado automáticamente por ${EMPRESA.NOMBRE} · Pedido ${codigoPedido}
        </div>

    </div>

    <!-- ── Footer ── -->
    <div class="factura__footer">
        <div class="factura__footer-txt">
            Ante cualquier duda escríbenos a
            <strong>${EMPRESA.EMAIL}</strong>
            o al <strong>${EMPRESA.TELEFONO}</strong>.
            Horarios: ${EMPRESA.HORARIOS}.
        </div>
        <div class="factura__footer-marca">
            ${EMPRESA.NOMBRE} &copy; ${new Date().getFullYear()}
        </div>
    </div>

</div>
</body>
</html>`;
}

// ── Descarga PDF ──────────────────────────────────────────────────────────────

/**
 * Genera y descarga la factura como PDF.
 * Carga html2canvas + jsPDF de forma lazy desde CDN.
 * @param {object} order
 */
export async function descargarFacturaPDF(order) {
    await _cargarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');
    await _cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:820px;height:1px;border:0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(generarHTMLFactura(order));
    doc.close();

    await new Promise(r => setTimeout(r, 900));

    try {
        const facturaEl = doc.getElementById('factura-root');
        const canvas    = await window.html2canvas(facturaEl, {
            scale: 2, useCORS: true, allowTaint: true,
            backgroundColor: '#ffffff', logging: false,
        });

        const imgData   = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf        = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });

        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = pageW / canvas.width;
        const imgH  = canvas.height * ratio;

        let posY = 0;
        while (posY < imgH) {
            pdf.addImage(imgData, 'PNG', 0, -posY, pageW, imgH);
            posY += pageH;
            if (posY < imgH) pdf.addPage();
        }

        // Nombre del archivo usa el código secuencial
        const codigo = _resolverCodigoPedido(order);
        pdf.save(`Factura-${codigo}.pdf`);
    } finally {
        document.body.removeChild(iframe);
    }
}

/**
 * Abre la factura en nueva ventana y llama a window.print().
 * @param {object} order
 */
export function imprimirFactura(order) {
    const ventana = window.open('', '_blank', 'width=840,height=920');
    ventana.document.write(generarHTMLFactura(order));
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 650);
}

// ── Loader de scripts dinámicos ───────────────────────────────────────────────
function _cargarScript(src, globalCheck) {
    return new Promise((resolve, reject) => {
        if (window[globalCheck]) { resolve(); return; }
        const s   = document.createElement('script');
        s.src     = src;
        s.onload  = resolve;
        s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(s);
    });
}
