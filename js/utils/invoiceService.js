// js/utils/invoiceService.js
// ─────────────────────────────────────────────────────────────────────────────
// Servicio de Facturación — Maye Mundo Belleza
//
// Responsabilidades:
//   - Generar el HTML de la factura/comprobante de compra.
//   - Disparar la descarga en PDF via html2canvas + jsPDF (cargados desde CDN).
//   - Exponer impresión optimizada con @media print.
//
// USO:
//   import { descargarFacturaPDF, imprimirFactura } from './invoiceService.js';
//   await descargarFacturaPDF(order);
// ─────────────────────────────────────────────────────────────────────────────

import { EMPRESA, waLink } from './constants.js';
import { formatearPrecio } from '../data/productos.data.js';

// ── Labels legibles para métodos de pago y estados ────────────────────────────
const METODO_LABEL = {
    nequi:         'Nequi',
    bancolombia:   'Bancolombia PSE / Transferencia',
    contraentrega: 'Pago Contraentrega (Efectivo)',
};

const ESTADO_LABEL = {
    pending:     'Pendiente de pago',
    enviado:     'Enviado',
    completado:  'Completado',
    cancelado:   'Cancelado',
};

const ESTADO_COLOR = {
    pending:     '#f97316',
    enviado:     '#3b82f6',
    completado:  '#2A8C64',
    cancelado:   '#ef4444',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtFecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ── Generador del HTML de la factura ─────────────────────────────────────────

/**
 * Genera el HTML completo de la factura para una orden.
 * El HTML es autocontenido (estilos inline) para ser compatible con
 * html2canvas y con @media print.
 *
 * @param {object} order - Orden normalizada de orderService.js
 * @returns {string} HTML string
 */
export function generarHTMLFactura(order) {
    const estadoColor = ESTADO_COLOR[order.status] ?? '#6b7280';
    const metodoPago  = METODO_LABEL[order.paymentMethod] ?? order.paymentMethod;
    const estadoLabel = ESTADO_LABEL[order.status]        ?? order.status;

    const filasItems = (order.items ?? []).map(item => `
        <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:0.875rem;color:#374151">
                ${item.title}
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:0.875rem;color:#374151">
                ${item.quantity}
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:0.875rem;color:#374151">
                ${formatearPrecio(item.price)}
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;
                       font-weight:700;font-size:0.875rem;color:#1C3F2D">
                ${formatearPrecio(item.price * item.quantity)}
            </td>
        </tr>`).join('');

    return /* html */`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura ${order.id} — ${EMPRESA.NOMBRE}</title>
    <style>
        /* ── Reset & base ── */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #f4f4f6;
            color: #1f2937;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .factura {
            background: #fff;
            max-width: 760px;
            margin: 32px auto;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.10);
            overflow: hidden;
        }

        /* ── Encabezado ── */
        .factura__header {
            background: linear-gradient(135deg, #1C3F2D 0%, #2A8C64 100%);
            padding: 32px 40px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
        }
        .factura__logo-wrap { display: flex; align-items: center; gap: 14px; }
        .factura__logo {
            width: 52px; height: 52px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.25);
            background: rgba(255,255,255,0.12);
        }
        .factura__empresa-nombre {
            font-size: 1.2rem; font-weight: 700;
            color: #fff; letter-spacing: 0.01em;
        }
        .factura__empresa-sub {
            font-size: 0.75rem; color: rgba(255,255,255,0.72);
            margin-top: 3px;
        }
        .factura__num-wrap { text-align: right; }
        .factura__num-label {
            font-size: 0.7rem; text-transform: uppercase;
            letter-spacing: 0.1em; color: rgba(255,255,255,0.6);
        }
        .factura__num {
            font-size: 1.1rem; font-weight: 700;
            color: #fff; margin-top: 2px;
        }
        .factura__fecha {
            font-size: 0.75rem; color: rgba(255,255,255,0.72);
            margin-top: 4px;
        }

        /* ── Badge de estado ── */
        .factura__estado-badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 50px;
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-top: 6px;
            color: #fff;
        }

        /* ── Sección 2 columnas ── */
        .factura__body { padding: 32px 40px; }
        .factura__dos-col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 28px;
        }
        .factura__bloque-titulo {
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #9ca3af;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .factura__bloque-valor {
            font-size: 0.875rem;
            color: #374151;
            line-height: 1.7;
        }
        .factura__bloque-valor strong { color: #1f2937; }

        /* ── Tabla de ítems ── */
        .factura__tabla { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .factura__tabla thead tr {
            background: #FAF7F2;
        }
        .factura__tabla th {
            padding: 10px 12px;
            text-align: left;
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            font-weight: 700;
            border-bottom: 2px solid #e5e7eb;
        }
        .factura__tabla th:nth-child(n+2) { text-align: center; }
        .factura__tabla th:last-child      { text-align: right; }

        /* ── Totales ── */
        .factura__totales {
            border-top: 2px solid #e5e7eb;
            padding-top: 16px;
            margin-left: auto;
            max-width: 280px;
        }
        .factura__totales-fila {
            display: flex;
            justify-content: space-between;
            font-size: 0.875rem;
            color: #6b7280;
            padding: 4px 0;
        }
        .factura__totales-fila--total {
            font-size: 1.05rem;
            font-weight: 700;
            color: #1f2937;
            border-top: 1.5px solid #e5e7eb;
            margin-top: 8px;
            padding-top: 10px;
        }
        .factura__totales-fila--total span:last-child { color: #2A8C64; }

        /* ── Método de pago ── */
        .factura__pago {
            margin-top: 24px;
            background: #FAF7F2;
            border-radius: 8px;
            padding: 14px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.875rem;
            color: #374151;
        }
        .factura__pago-icon {
            width: 32px; height: 32px;
            background: rgba(42,140,100,0.12);
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1rem; color: #2A8C64; flex-shrink: 0;
        }

        /* ── Footer ── */
        .factura__footer {
            background: #FAF7F2;
            border-top: 1px solid #e5e7eb;
            padding: 18px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
        }
        .factura__footer-txt { font-size: 0.75rem; color: #9ca3af; }
        .factura__footer-marca {
            font-size: 0.8rem;
            font-weight: 700;
            color: #2A8C64;
        }

        /* ── @media print ── */
        @media print {
            body { background: #fff; }
            .factura {
                box-shadow: none;
                margin: 0;
                border-radius: 0;
                max-width: 100%;
            }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
<div class="factura" id="factura-root">

    <!-- Encabezado -->
    <div class="factura__header">
        <div class="factura__logo-wrap">
            <img src="https://res.cloudinary.com/ocnnxclz/image/upload/v1784219028/333_mvofgw.png"
                 alt="${EMPRESA.NOMBRE}" class="factura__logo">
            <div>
                <div class="factura__empresa-nombre">${EMPRESA.NOMBRE}</div>
                <div class="factura__empresa-sub">
                    ${EMPRESA.UBICACION} &nbsp;|&nbsp; ${EMPRESA.TELEFONO}
                </div>
                <div class="factura__empresa-sub">${EMPRESA.EMAIL}</div>
            </div>
        </div>
        <div class="factura__num-wrap">
            <div class="factura__num-label">Comprobante de Compra</div>
            <div class="factura__num">${order.id}</div>
            <div class="factura__fecha">${fmtFecha(order.createdAt)}</div>
            <div>
                <span class="factura__estado-badge"
                      style="background:${estadoColor}">
                    ${estadoLabel}
                </span>
            </div>
        </div>
    </div>

    <!-- Cuerpo -->
    <div class="factura__body">

        <!-- Datos cliente + envío -->
        <div class="factura__dos-col">
            <div>
                <div class="factura__bloque-titulo">Datos del cliente</div>
                <div class="factura__bloque-valor">
                    <strong>${order.customerInfo?.name ?? '—'}</strong><br>
                    Tel: ${order.customerInfo?.phone ?? '—'}<br>
                    ${order.customerInfo?.notes
                        ? `Notas: ${order.customerInfo.notes}`
                        : ''}
                </div>
            </div>
            <div>
                <div class="factura__bloque-titulo">Dirección de entrega</div>
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
        <div class="factura__totales">
            <div class="factura__totales-fila">
                <span>Subtotal</span>
                <span>${formatearPrecio(order.pricing?.subtotal ?? 0)}</span>
            </div>
            <div class="factura__totales-fila">
                <span>Envío</span>
                <span>${formatearPrecio(order.pricing?.shipping ?? 0)}</span>
            </div>
            <div class="factura__totales-fila factura__totales-fila--total">
                <span>TOTAL</span>
                <span>${formatearPrecio(order.pricing?.total ?? 0)}</span>
            </div>
        </div>

        <!-- Método de pago -->
        <div class="factura__pago">
            <div class="factura__pago-icon">💳</div>
            <div>
                <strong>Método de pago:</strong> ${metodoPago}
            </div>
        </div>

    </div><!-- /.factura__body -->

    <!-- Footer -->
    <div class="factura__footer">
        <div class="factura__footer-txt">
            Gracias por tu compra. Ante cualquier inquietud escríbenos a
            <strong>${EMPRESA.EMAIL}</strong> o por WhatsApp al <strong>${EMPRESA.TELEFONO}</strong>.
        </div>
        <div class="factura__footer-marca">${EMPRESA.NOMBRE} © ${new Date().getFullYear()}</div>
    </div>

</div>
</body>
</html>`;
}

// ── Descarga PDF ──────────────────────────────────────────────────────────────

/**
 * Genera y descarga la factura como PDF.
 * Usa html2canvas + jsPDF cargados desde CDN (no requieren npm install).
 * Se inyectan dinámicamente solo cuando se necesitan (lazy load).
 *
 * @param {object} order
 * @returns {Promise<void>}
 */
export async function descargarFacturaPDF(order) {
    // ── Cargar dependencias de forma lazy ─────────────────────────────────
    await _cargarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');
    await _cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');

    // ── Renderizar HTML de la factura en un iframe oculto ─────────────────
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;height:1px;border:0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(generarHTMLFactura(order));
    doc.close();

    // Esperar a que cargue la imagen del logo
    await new Promise(r => setTimeout(r, 800));

    try {
        const facturaEl = doc.getElementById('factura-root');
        const canvas    = await window.html2canvas(facturaEl, {
            scale:           2,
            useCORS:         true,
            allowTaint:      true,
            backgroundColor: '#ffffff',
            logging:         false,
        });

        const imgData  = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf       = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });

        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = pageW / canvas.width;
        const imgH  = canvas.height * ratio;

        // Si la imagen es más alta que la página, dividir en múltiples páginas
        let posY = 0;
        while (posY < imgH) {
            pdf.addImage(imgData, 'PNG', 0, -posY, pageW, imgH);
            posY += pageH;
            if (posY < imgH) pdf.addPage();
        }

        pdf.save(`Factura-${order.id}.pdf`);
    } finally {
        document.body.removeChild(iframe);
    }
}

/**
 * Abre la factura en una nueva ventana y llama a window.print().
 * @param {object} order
 */
export function imprimirFactura(order) {
    const ventana = window.open('', '_blank', 'width=820,height=900');
    ventana.document.write(generarHTMLFactura(order));
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 600);
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
