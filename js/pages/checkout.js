// js/pages/checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Motor del Checkout — Maye Mundo Belleza
//
// Flujo completo:
//  1. Recupera ítems del carrito (o snapshot si el usuario recargó).
//  2. Pre-rellena el formulario con datos del perfil de sesión activa.
//  3. Gestiona cupón de descuento: validar → aplicar → quitar → recalcular.
//  4. Valida el formulario al enviar.
//  5. Llama a crearOrden() con el descuento aplicado.
//  6. Métodos manuales (Nequi / Bancolombia / Contraentrega):
//       registra pago manual → guarda IDs en sessionStorage → redirige a éxito.
// ─────────────────────────────────────────────────────────────────────────────

import { getSession }                           from '../utils/authService.js';
import { obtenerItems }                         from '../utils/carrito.js';
import { crearOrden, guardarSnapshotCheckout,
         obtenerSnapshotCheckout,
         ORDER_ERRORS }                         from '../utils/orderService.js';
import { validarCuponAsync, COUPON_ERRORS }     from '../utils/couponService.js';
import { registrarPagoManual, registrarTransaccion,
         PAYMENT_STATUS }                       from '../utils/paymentService.js';
import { crearPreferenciaMercadoPago }          from '../services/mercadoPagoService.js';
import { formatearPrecio }                      from '../data/productos.data.js';
import { RUTAS, SHIPPING_COST, ENVIO_GRATIS_MINIMO, PAYMENT_SESSION_KEYS } from '../utils/constants.js';
import Storage                                  from '../utils/storage.js';

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DEL MÓDULO
// ─────────────────────────────────────────────────────────────────────────────

/** Cupón actualmente aplicado: null | { codigo, descuento, cupon } */
let _cuponAplicado = null;

/** Ítems del carrito en uso para el checkout actual */
let _itemsActuales = [];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: CÁLCULO DE ENVÍO (fuente única de la regla de envío gratis)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Devuelve el costo de envío real según el subtotal de los ítems.
 * Usa el mismo umbral que carrito.html para garantizar coherencia.
 * @param {number} subtotal  Suma de precio × cantidad de todos los ítems
 * @returns {number}  0 si el subtotal alcanza ENVIO_GRATIS_MINIMO, o SHIPPING_COST
 */
function _calcularEnvio(subtotal) {
    return subtotal >= ENVIO_GRATIS_MINIMO ? 0 : SHIPPING_COST;
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────
export function iniciarCheckout() {
    const session = getSession();

    // ── Obtener ítems ─────────────────────────────────────────────────────
    let items = obtenerItems();
    if (!items.length) {
        const snap = obtenerSnapshotCheckout();
        if (snap?.length) items = snap;
        else {
            document.getElementById('checkout-grid')?.setAttribute('hidden', '');
            document.getElementById('co-carrito-vacio')?.removeAttribute('hidden');
            return;
        }
    }

    _itemsActuales = items;
    guardarSnapshotCheckout(items);

    // ── Render inicial ────────────────────────────────────────────────────
    _renderResumen(items, null);

    document.getElementById('checkout-grid')?.removeAttribute('hidden');
    document.getElementById('co-carrito-vacio')?.setAttribute('hidden', '');

    _prefillFormulario(session);
    _iniciarMetodosPago();
    _iniciarCupon(items);

    // ── Notificación de fallo o cancelación si retorna de Mercado Pago ──
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('status') === 'failure') {
        _mostrarAlerta('El pago mediante Mercado Pago fue cancelado o no se pudo procesar. Puedes reintentar o elegir otro medio de pago.');
    }

    // ── Botón volver ──────────────────────────────────────────────────────
    document.getElementById('btn-volver-carrito')
        ?.addEventListener('click', () => history.back());

    // ── Botón confirmar ───────────────────────────────────────────────────
    // BUG FIX: no capturar `items` en closure — usar _itemsActuales para
    // que siempre refleje el estado más reciente del carrito.
    document.getElementById('co-btn-confirmar')
        ?.addEventListener('click', () => _manejarConfirmar(_itemsActuales, session));
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER RESUMEN (recalcula totales con descuento opcional)
// ─────────────────────────────────────────────────────────────────────────────
function _renderResumen(items, cupon) {
    const lista   = document.getElementById('co-items-lista');
    const totales = document.getElementById('co-totales');
    if (!lista || !totales) return;

    const subtotal  = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const shipping  = _calcularEnvio(subtotal);
    const descuento = cupon?.descuento ?? 0;
    const total     = Math.max(subtotal + shipping - descuento, 1);

    lista.innerHTML = items.map(item => {
        const img = item.imagen || 'https://placehold.co/48x48/FAF7F2/2A8C64?text=Maye';
        return `
        <div class="co-resumen-item">
            <img src="${img}" alt="${_esc(item.nombre)}" class="co-resumen-item__img"
                 onerror="this.src='https://placehold.co/48x48/FAF7F2/2A8C64?text=Maye'">
            <div style="flex:1;min-width:0">
                <div class="co-resumen-item__nombre">${_esc(item.nombre)}</div>
                <span class="co-resumen-item__qty">× ${item.cantidad}</span>
            </div>
            <div class="co-resumen-item__precio">
                ${formatearPrecio(item.precio * item.cantidad)}
            </div>
        </div>`;
    }).join('');

    // Fila de descuento solo si hay cupón activo
    const filaDescuento = descuento > 0 ? `
        <div class="co-totales__fila co-totales__fila--descuento">
            <span>
                Cupón
                <strong style="font-size:0.78rem;opacity:.8">
                    ${_esc(cupon.cupon?.codigo ?? '')}
                </strong>
            </span>
            <span>${formatearPrecio(descuento)}</span>
        </div>` : '';

    // Etiqueta y valor del envío — coherente con carrito.html
    const shippingLabel = shipping === 0
        ? `<span style="color:var(--verde-principal);font-weight:700">¡Gratis!</span>`
        : `<span style="color:var(--verde-principal);font-weight:600">${formatearPrecio(shipping)}</span>`;

    totales.innerHTML = `
        <div class="co-totales__fila">
            <span>${items.length} producto${items.length !== 1 ? 's' : ''}</span>
            <span>${formatearPrecio(subtotal)}</span>
        </div>
        <div class="co-totales__fila">
            <span>Envío</span>
            ${shippingLabel}
        </div>
        ${filaDescuento}
        <div class="co-totales__fila co-totales__fila--total">
            <span>Total a pagar</span>
            <span>${formatearPrecio(total)}</span>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE CUPONES
// ─────────────────────────────────────────────────────────────────────────────
function _iniciarCupon(items) {
    const btnAplicar = document.getElementById('co-cupon-btn-aplicar');
    const btnQuitar  = document.getElementById('co-cupon-btn-quitar');
    const input      = document.getElementById('co-cupon-input');

    // Tecla Enter en el campo → aplicar
    input?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); _aplicarCupon(items); }
    });

    // Limpiar error al escribir
    input?.addEventListener('input', () => _setCuponError(''));

    btnAplicar?.addEventListener('click', () => _aplicarCupon(items));
    btnQuitar?.addEventListener('click',  () => _quitarCupon(items));

    // Si viene cupón en la URL desde carrito.html, pre-aplicarlo automáticamente
    const cuponQuery = new URLSearchParams(window.location.search).get('cupon');
    if (cuponQuery && input) {
        input.value = cuponQuery;
        _aplicarCupon(items);
    }
}

async function _aplicarCupon(items) {
    const input  = document.getElementById('co-cupon-input');
    const btnApl = document.getElementById('co-cupon-btn-aplicar');
    const codigo = input?.value.trim().toUpperCase();

    if (!codigo) {
        _setCuponError('Escribe un código de cupón.');
        return;
    }

    // Estado de carga en el botón
    btnApl?.classList.add('cargando');
    if (btnApl) btnApl.disabled = true;
    _setCuponError('');

    try {
        const subtotal  = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
        const resultado = await validarCuponAsync(codigo, subtotal);

        if (!resultado.ok) {
            const msgs = {
                [COUPON_ERRORS.NOT_FOUND]:     'Código de cupón no válido o inexistente.',
                [COUPON_ERRORS.EXPIRED]:        'Este cupón ha expirado.',
                [COUPON_ERRORS.INACTIVE]:       'Este cupón está inactivo.',
                [COUPON_ERRORS.LIMIT_REACHED]:  'Este cupón ya alcanzó su límite de usos.',
                [COUPON_ERRORS.MIN_PURCHASE]:   resultado.mensaje ?? 'No cumples la compra mínima.',
                [COUPON_ERRORS.FORBIDDEN]:      'Inicia sesión para aplicar cupones.',
            };
            _setCuponError(msgs[resultado.error] ?? resultado.mensaje ?? 'Cupón no válido.');
            return;
        }

        // ── Cupón válido: guardar estado y actualizar UI ──────────────────
        _cuponAplicado = {
            codigo,
            descuento: resultado.descuento,
            cupon:     resultado.cupon,
        };

        _mostrarCuponAplicado(codigo, resultado.mensaje);
        _renderResumen(items, _cuponAplicado);

    } catch (err) {
        console.error('[checkout] validarCupon error:', err);
        _setCuponError('Error al validar el cupón. Intenta de nuevo.');
    } finally {
        btnApl?.classList.remove('cargando');
        if (btnApl) btnApl.disabled = false;
    }
}

function _quitarCupon(items) {
    _cuponAplicado = null;

    // Restaurar el formulario
    const formWrap = document.getElementById('co-cupon-form-wrap');
    const badge    = document.getElementById('co-cupon-aplicado');
    const input    = document.getElementById('co-cupon-input');

    if (badge)    badge.setAttribute('hidden', '');
    if (formWrap) formWrap.removeAttribute('hidden');
    if (input) {
        input.value = '';
        input.focus();
    }

    _setCuponError('');
    _renderResumen(items, null);
}

function _mostrarCuponAplicado(codigo, descripcion) {
    const formWrap   = document.getElementById('co-cupon-form-wrap');
    const badge      = document.getElementById('co-cupon-aplicado');
    const codigoEl   = document.getElementById('co-cupon-codigo-visible');
    const descEl     = document.getElementById('co-cupon-desc-visible');

    if (formWrap) formWrap.setAttribute('hidden', '');
    if (codigoEl) codigoEl.textContent = codigo;
    if (descEl)   descEl.textContent   = descripcion ?? '';
    if (badge)    badge.removeAttribute('hidden');
}

function _setCuponError(msg) {
    const el = document.getElementById('co-cupon-error');
    if (!el) return;
    el.textContent = msg;
    msg ? el.removeAttribute('hidden') : el.setAttribute('hidden', '');
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-FILL FORMULARIO
// ─────────────────────────────────────────────────────────────────────────────
function _prefillFormulario(session) {
    if (!session) return;
    const users  = Storage.obtener('maye_users', []);
    const perfil = users.find(u => u.id === session.id) ?? {};
    const set    = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('co-nombre',    perfil.name    || session.name || '');
    set('co-telefono',  perfil.phone   || '');
    set('co-direccion', perfil.address || '');
    set('co-ciudad',    perfil.city    || '');
}

// ─────────────────────────────────────────────────────────────────────────────
// MÉTODOS DE PAGO
// ─────────────────────────────────────────────────────────────────────────────
function _iniciarMetodosPago() {
    document.querySelectorAll('input[name="metodoPago"]').forEach(r => {
        const label = r.closest('.co-metodo');
        if (r.checked && label) label.classList.add('co-metodo--seleccionado');
        r.addEventListener('change', () => {
            document.querySelectorAll('.co-metodo')
                .forEach(l => l.classList.remove('co-metodo--seleccionado'));
            r.closest('.co-metodo')?.classList.add('co-metodo--seleccionado');
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN
// ─────────────────────────────────────────────────────────────────────────────
function _validarFormulario() {
    const campos = ['co-nombre', 'co-telefono', 'co-direccion', 'co-ciudad'];
    let valido = true;
    campos.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        const padre = input.closest('.co-campo');
        const vacio = !input.value.trim();
        input.classList.toggle('co-campo--error', vacio);
        padre?.classList.toggle('co-campo--con-error', vacio);
        if (vacio) valido = false;
    });
    return valido;
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER CONFIRMAR — lógica principal de submit
// ─────────────────────────────────────────────────────────────────────────────
async function _manejarConfirmar(items, session) {
    _ocultarAlerta();

    if (!_validarFormulario()) {
        _mostrarAlerta('Completa todos los campos obligatorios antes de continuar.');
        document.querySelector('.co-campo--error')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const metodoPago = document.querySelector('input[name="metodoPago"]:checked')?.value;
    if (!metodoPago) {
        _mostrarAlerta('Selecciona un método de pago para continuar.');
        return;
    }

    const customerInfo = {
        name:    document.getElementById('co-nombre').value.trim(),
        phone:   document.getElementById('co-telefono').value.trim(),
        address: document.getElementById('co-direccion').value.trim(),
        city:    document.getElementById('co-ciudad').value.trim(),
        notes:   document.getElementById('co-notas')?.value.trim() ?? '',
    };

    const orderItems = items.map(i => ({
        productId: i.id,
        title:     i.nombre,
        price:     i.precio,
        quantity:  i.cantidad,
        imagen:    i.imagen ?? '',
    }));

    const descuento  = _cuponAplicado?.descuento ?? 0;
    const couponCode = _cuponAplicado?.codigo    ?? null;
    const couponId   = _cuponAplicado?.cupon?.id ?? null;

    // ── Estado de carga ───────────────────────────────────────────────────
    const btn = document.getElementById('co-btn-confirmar');
    if (btn) { btn.classList.add('cargando'); btn.disabled = true; }

    try {
        let order;
        let total;

        // Crear la orden con el método de pago seleccionado
        const resultado = await crearOrden({
            userId:         session?.id ?? 'guest',
            customerInfo,
            items:          orderItems,
            paymentMethod:  metodoPago,
            couponCode,
            couponId,
            discountAmount: descuento,
            shippingCost:   _calcularEnvio(items.reduce((s, i) => s + i.precio * i.cantidad, 0)),
        });

        if (!resultado.ok) {
            const msgs = {
                [ORDER_ERRORS.EMPTY_CART]:     'El carrito está vacío.',
                [ORDER_ERRORS.MISSING_FIELDS]: 'Faltan datos obligatorios.',
                [ORDER_ERRORS.OUT_OF_STOCK]:   resultado.detalle ?? 'Uno o más productos están agotados.',
                [ORDER_ERRORS.AUTH_REQUIRED]:  'Debes iniciar sesión para completar tu compra.',
            };
            _mostrarAlerta(msgs[resultado.error] ?? 'Error inesperado. Intenta de nuevo.');
            if (btn) { btn.classList.remove('cargando'); btn.disabled = false; }
            return;
        }

        order = resultado.order;
        const subtotalCalc = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
        const shippingCalc = _calcularEnvio(subtotalCalc);
        total = Math.max(subtotalCalc + shippingCalc - descuento, 1);

        if (metodoPago === 'mercadopago') {
            await _procesarPagoMercadoPago({
                order,
                items,
                customerInfo,
                total,
                descuento,
            });
            return;
        }

        await _procesarPagoManual({ order, metodoPago, total });

    } catch (err) {
        console.error('[Checkout] Error al crear orden:', err);
        _mostrarAlerta('Ocurrió un error inesperado. Por favor intenta de nuevo.');
    } finally {
        if (btn) { btn.classList.remove('cargando'); btn.disabled = false; }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// FLUJO MERCADO PAGO CHECKOUT PRO (MODO SANDBOX)
// ─────────────────────────────────────────────────────────────────────────────
async function _procesarPagoMercadoPago({ order, items, customerInfo, total, descuento }) {
    // 1. Preparar ítems para Mercado Pago
    const mpItems = items.map(i => ({
        id: String(i.id),
        title: i.nombre,
        quantity: i.cantidad,
        unit_price: i.precio,
        currency_id: 'COP',
        picture_url: i.imagen || '',
    }));

    // 2. Llamar al servicio de Mercado Pago con external_reference = order_number
    const prefResult = await crearPreferenciaMercadoPago({
        items: mpItems,
        shippingCost: _calcularEnvio(items.reduce((s, i) => s + i.precio * i.cantidad, 0)),
        orderNumber: order.orderNumber || order.id,
        customerInfo,
        discountAmount: descuento,
    });

    if (!prefResult.ok || !prefResult.preference?.id) {
        throw new Error(prefResult.error || 'No se pudo generar la preferencia de pago en Mercado Pago.');
    }

    const preference = prefResult.preference;

    // 3. Registrar la transacción en payment_transactions con gateway = 'mercadopago' y external_id = preference.id
    const txResult = await registrarTransaccion({
        orderId: order.id,
        gateway: 'mercadopago',
        externalId: preference.id,
        amount: total,
        status: PAYMENT_STATUS.PENDING,
        gatewayPayload: preference,
    });

    if (!txResult.ok) {
        console.warn('[checkout] Aviso al registrar payment_transactions:', txResult.error);
    }

    // 4. Guardar datos en sessionStorage para el seguimiento
    sessionStorage.setItem(PAYMENT_SESSION_KEYS.ULTIMA_ORDEN, order.id);
    sessionStorage.setItem('maye_ultima_orden_number', order.orderNumber ?? '');
    sessionStorage.setItem('maye_mp_preference_id', preference.id);
    sessionStorage.removeItem(PAYMENT_SESSION_KEYS.ORDEN_PENDIENTE);

    // 5. Redirigir al usuario al sandbox_init_point devuelto por la API
    const redirectUrl = prefResult.sandbox_init_point || preference.sandbox_init_point || preference.init_point;
    if (!redirectUrl) {
        throw new Error('Mercado Pago no devolvió una URL válida de pago.');
    }

    window.location.href = redirectUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO MANUAL — Nequi / Bancolombia / Contraentrega
// ─────────────────────────────────────────────────────────────────────────────
async function _procesarPagoManual({ order, metodoPago, total }) {
    // Registrar la transacción en payment_transactions con status pending
    await registrarPagoManual(order.id, metodoPago, total);

    // Guardar en sessionStorage y redirigir a la página de confirmación
    sessionStorage.setItem(PAYMENT_SESSION_KEYS.ULTIMA_ORDEN, order.id);
    sessionStorage.setItem('maye_ultima_orden_number', order.orderNumber ?? '');
    sessionStorage.removeItem(PAYMENT_SESSION_KEYS.ORDEN_PENDIENTE);

    window.location.href = RUTAS.PEDIDO_EXITOSO;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS UI
// ─────────────────────────────────────────────────────────────────────────────
function _mostrarAlerta(msg) {
    const el  = document.getElementById('co-alerta');
    const txt = document.getElementById('co-alerta-texto');
    if (!el || !txt) return;
    txt.textContent = msg;
    el.removeAttribute('hidden');
    el.classList.add('co-alerta--visible');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _ocultarAlerta() {
    const el = document.getElementById('co-alerta');
    if (!el) return;
    el.setAttribute('hidden', '');
    el.classList.remove('co-alerta--visible');
}

/** Escapa caracteres peligrosos para atributos y contenido HTML */
function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
