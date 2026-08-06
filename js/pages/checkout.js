// js/pages/checkout.js
// ─────────────────────────────────────────────────────────────────────────────
// Motor del Checkout — Maye Mundo Belleza
//
// Flujo:
//  1. Recupera ítems del carrito (o del snapshot si el usuario recargó).
//  2. Pre-rellena el formulario con datos del perfil de sesión activa.
//  3. Valida el formulario al enviar.
//  4. Llama a crearOrden() del orderService.
//  5. Guarda el ID de la orden en sessionStorage y redirige a pedido-exitoso.
// ─────────────────────────────────────────────────────────────────────────────

import { getSession }                          from '../utils/authService.js';
import { obtenerItems }                        from '../utils/carrito.js';
import { crearOrden, guardarSnapshotCheckout,
         obtenerSnapshotCheckout, ORDER_ERRORS } from '../utils/orderService.js';
import { formatearPrecio }                     from '../data/productos.data.js';
import { RUTAS, SHIPPING_COST, waLink,
         STORAGE_KEYS }                        from '../utils/constants.js';
import Storage                                 from '../utils/storage.js';

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────
export function iniciarCheckout() {
    const session = getSession();

    // ── Obtener ítems (carrito en vivo o snapshot guardado) ───────────────
    let items = obtenerItems();
    if (items.length === 0) {
        const snap = obtenerSnapshotCheckout();
        if (snap && snap.length > 0) {
            items = snap;
        } else {
            // Carrito vacío → mostrar pantalla vacía en lugar de redirigir
            document.getElementById('checkout-grid')?.setAttribute('hidden', '');
            const vacioDom = document.getElementById('co-carrito-vacio');
            if (vacioDom) vacioDom.removeAttribute('hidden');
            return;
        }
    }

    // Guardar snapshot para resistir recarga de página
    guardarSnapshotCheckout(items);

    // ── Renderizar resumen de orden ───────────────────────────────────────
    _renderResumen(items);

    // ── Mostrar el grid, ocultar el estado vacío ──────────────────────────
    document.getElementById('checkout-grid')?.removeAttribute('hidden');
    document.getElementById('co-carrito-vacio')?.setAttribute('hidden', '');

    // ── Pre-rellenar formulario con datos del perfil ──────────────────────
    _prefillFormulario(session);

    // ── Resaltar método de pago seleccionado ──────────────────────────────
    _iniciarMetodosPago();

    // ── Botón volver ──────────────────────────────────────────────────────
    document.getElementById('btn-volver-carrito')
        ?.addEventListener('click', () => history.back());

    // ── Botón confirmar pedido ────────────────────────────────────────────
    document.getElementById('co-btn-confirmar')
        ?.addEventListener('click', () => _manejarConfirmar(items, session));
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER RESUMEN
// ─────────────────────────────────────────────────────────────────────────────
function _renderResumen(items) {
    const lista    = document.getElementById('co-items-lista');
    const totales  = document.getElementById('co-totales');
    if (!lista || !totales) return;

    const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const shipping = SHIPPING_COST;
    const total    = subtotal + shipping;

    lista.innerHTML = items.map(item => {
        const imgSrc = item.imagen || 'https://placehold.co/48x48/FAF7F2/2A8C64?text=Maye';
        return `
        <div class="co-resumen-item">
            <img src="${imgSrc}" alt="${item.nombre}" class="co-resumen-item__img"
                 onerror="this.src='https://placehold.co/48x48/FAF7F2/2A8C64?text=Maye'">
            <div style="flex:1;min-width:0">
                <div class="co-resumen-item__nombre">${item.nombre}</div>
                <span class="co-resumen-item__qty">× ${item.cantidad}</span>
            </div>
            <div class="co-resumen-item__precio">
                ${formatearPrecio(item.precio * item.cantidad)}
            </div>
        </div>`;
    }).join('');

    totales.innerHTML = `
        <div class="co-totales__fila">
            <span>${items.length} producto${items.length !== 1 ? 's' : ''}</span>
            <span>${formatearPrecio(subtotal)}</span>
        </div>
        <div class="co-totales__fila">
            <span>Envío estándar</span>
            <span style="color:var(--verde-principal);font-weight:600">
                ${formatearPrecio(shipping)}
            </span>
        </div>
        <div class="co-totales__fila co-totales__fila--total">
            <span>Total a pagar</span>
            <span>${formatearPrecio(total)}</span>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-FILL FORMULARIO
// ─────────────────────────────────────────────────────────────────────────────
function _prefillFormulario(session) {
    if (!session) return;

    // Obtener datos completos del perfil desde maye_users
    const users   = Storage.obtener('maye_users', []);
    const perfil  = users.find(u => u.id === session.id) ?? {};

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
    };

    set('co-nombre',    perfil.name    || session.name    || '');
    set('co-telefono',  perfil.phone   || '');
    set('co-direccion', perfil.address || '');
    set('co-ciudad',    perfil.city    || '');
}

// ─────────────────────────────────────────────────────────────────────────────
// MÉTODOS DE PAGO — resaltar seleccionado
// ─────────────────────────────────────────────────────────────────────────────
function _iniciarMetodosPago() {
    const radios = document.querySelectorAll('input[name="metodoPago"]');
    radios.forEach(r => {
        // Estado inicial
        const label = r.closest('.co-metodo');
        if (r.checked && label) label.classList.add('co-metodo--seleccionado');

        r.addEventListener('change', () => {
            document.querySelectorAll('.co-metodo').forEach(l =>
                l.classList.remove('co-metodo--seleccionado')
            );
            const parentLabel = r.closest('.co-metodo');
            if (parentLabel) parentLabel.classList.add('co-metodo--seleccionado');
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDACIÓN DEL FORMULARIO
// ─────────────────────────────────────────────────────────────────────────────
function _validarFormulario() {
    const campos = [
        { id: 'co-nombre',    wrapperId: null },
        { id: 'co-telefono',  wrapperId: null },
        { id: 'co-direccion', wrapperId: null },
        { id: 'co-ciudad',    wrapperId: null },
    ];

    let valido = true;

    // Validación: actualiza clases en el padre .co-campo
    campos.forEach(({ id }) => {
        const input = document.getElementById(id);
        if (!input) return;
        // Padre puede ser .co-campo (nuevo HTML) o el input directamente
        const padre = input.closest('.co-campo');
        const vacio = !input.value.trim();
        input.classList.toggle('co-campo--error', vacio);
        padre?.classList.toggle('co-campo--con-error', vacio);
        if (vacio) valido = false;
    });

    return valido;
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER CONFIRMAR
// ─────────────────────────────────────────────────────────────────────────────
async function _manejarConfirmar(items, session) {
    _ocultarAlerta();

    if (!_validarFormulario()) {
        _mostrarAlerta('Completa todos los campos obligatorios antes de continuar.');
        // Scroll suave al primer campo con error
        document.querySelector('.co-campo--error')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const metodoPago = document.querySelector('input[name="metodoPago"]:checked')?.value;
    if (!metodoPago) {
        _mostrarAlerta('Selecciona un método de pago para continuar.');
        return;
    }

    // ── Construir payload ─────────────────────────────────────────────────
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

    // ── Estado de carga ───────────────────────────────────────────────────
    const btn = document.getElementById('co-btn-confirmar');
    btn?.classList.add('cargando');
    if (btn) btn.disabled = true;

    try {
        const resultado = await crearOrden({
            userId: session?.id ?? 'guest',
            customerInfo,
            items: orderItems,
            paymentMethod: metodoPago,
        });

        if (!resultado.ok) {
            const msgs = {
                [ORDER_ERRORS.EMPTY_CART]:     'El carrito está vacío.',
                [ORDER_ERRORS.MISSING_FIELDS]: 'Faltan datos obligatorios.',
                [ORDER_ERRORS.OUT_OF_STOCK]:   resultado.detalle ?? 'Uno o más productos están agotados.',
            };
            _mostrarAlerta(msgs[resultado.error] ?? 'Error inesperado. Intenta de nuevo.');
            return;
        }

        // ── Éxito: guardar orden en sessionStorage y redirigir ────────────
        // Se guarda el UUID interno (para buscar la orden completa) y el
        // orderNumber secuencial (MMB-XXXXX) para mostrarlo sin otra query.
        sessionStorage.setItem('maye_ultima_orden',        resultado.order.id);
        sessionStorage.setItem('maye_ultima_orden_number', resultado.order.orderNumber ?? '');
        window.location.href = RUTAS.PEDIDO_EXITOSO;

    } catch (err) {
        console.error('[Checkout] Error al crear orden:', err);
        _mostrarAlerta('Ocurrió un error inesperado. Por favor intenta de nuevo.');
    } finally {
        btn?.classList.remove('cargando');
        if (btn) btn.disabled = false;
    }
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
