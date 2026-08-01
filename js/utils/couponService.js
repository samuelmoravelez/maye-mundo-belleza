// js/utils/couponService.js
// ─────────────────────────────────────────────────────────────────────────────
// Servicio de Cupones / Promociones — Maye Mundo Belleza
//
// Persiste en localStorage bajo STORAGE_KEYS.COUPONS ('maye_coupons').
//
// Estructura normalizada de un cupón:
// {
//   id:          'COUP_xxx',
//   codigo:      'MAYE10',           ← código que escribe el cliente (uppercase)
//   tipo:        'porcentaje'|'fijo',
//   valor:        10,                 ← 10 = 10% o $10.000 fijo
//   minCompra:    0,                  ← monto mínimo del carrito (0 = sin mínimo)
//   activo:       true,
//   usoMaximo:    null,               ← null = ilimitado
//   usosActuales: 0,
//   fechaVence:   null,               ← ISO string o null
//   descripcion: '',
//   createdAt:   ISO string,
// }
//
// ARQUITECTURA: async/await puro — migracion a API real solo requiere
// cambiar las funciones _get/_save por llamadas fetch.
// ─────────────────────────────────────────────────────────────────────────────

import Storage from './storage.js';
import { STORAGE_KEYS } from './constants.js';
import { getSession, ROLES } from './authService.js';

const KEY = STORAGE_KEYS.COUPONS;

// ── Errores tipados ───────────────────────────────────────────────────────────
export const COUPON_ERRORS = Object.freeze({
    NOT_FOUND:      'NOT_FOUND',
    EXPIRED:        'EXPIRED',
    INACTIVE:       'INACTIVE',
    LIMIT_REACHED:  'LIMIT_REACHED',
    MIN_PURCHASE:   'MIN_PURCHASE',
    DUPLICATE_CODE: 'DUPLICATE_CODE',
    MISSING_FIELDS: 'MISSING_FIELDS',
    FORBIDDEN:      'FORBIDDEN',
});

// ── Helpers internos ──────────────────────────────────────────────────────────
function _get() {
    const raw = Storage.obtener(KEY, []);
    return Array.isArray(raw) ? raw : [];
}

function _save(cupones) {
    Storage.guardar(KEY, cupones);
}

function _generarId() {
    return `COUP_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ── API PÚBLICA ───────────────────────────────────────────────────────────────

/**
 * Devuelve todos los cupones del sistema.
 * @returns {object[]}
 */
export function obtenerCupones() {
    return _get();
}

/**
 * Crea un nuevo cupón. Solo admins.
 *
 * @param {{
 *   codigo:      string,
 *   tipo:        'porcentaje'|'fijo',
 *   valor:       number,
 *   minCompra?:  number,
 *   usoMaximo?:  number|null,
 *   fechaVence?: string|null,
 *   descripcion?:string,
 * }} datos
 * @returns {{ ok:boolean, cupon?:object, error?:string }}
 */
export function crearCupon(datos) {
    const session = getSession();
    if (session?.role !== ROLES.ADMIN) {
        return { ok: false, error: COUPON_ERRORS.FORBIDDEN };
    }

    const { codigo, tipo, valor, minCompra = 0,
            usoMaximo = null, fechaVence = null, descripcion = '' } = datos;

    if (!codigo?.trim() || !tipo || !valor) {
        return { ok: false, error: COUPON_ERRORS.MISSING_FIELDS };
    }

    const codigoNorm = codigo.trim().toUpperCase();
    const cupones    = _get();

    if (cupones.some(c => c.codigo === codigoNorm)) {
        return { ok: false, error: COUPON_ERRORS.DUPLICATE_CODE };
    }

    if (!['porcentaje', 'fijo'].includes(tipo)) {
        return { ok: false, error: COUPON_ERRORS.MISSING_FIELDS };
    }

    const nuevoCupon = {
        id:           _generarId(),
        codigo:       codigoNorm,
        tipo,
        valor:        Number(valor),
        minCompra:    Number(minCompra) || 0,
        activo:       true,
        usoMaximo:    usoMaximo ? Number(usoMaximo) : null,
        usosActuales: 0,
        fechaVence:   fechaVence || null,
        descripcion:  descripcion.trim(),
        createdAt:    new Date().toISOString(),
    };

    _save([...cupones, nuevoCupon]);
    return { ok: true, cupon: nuevoCupon };
}

/**
 * Actualiza un cupón existente. Solo admins.
 * @param {string} couponId
 * @param {object} cambios — campos a actualizar (parcial)
 * @returns {{ ok:boolean, cupon?:object, error?:string }}
 */
export function actualizarCupon(couponId, cambios) {
    const session = getSession();
    if (session?.role !== ROLES.ADMIN) {
        return { ok: false, error: COUPON_ERRORS.FORBIDDEN };
    }

    const cupones = _get();
    const idx     = cupones.findIndex(c => c.id === couponId);
    if (idx === -1) return { ok: false, error: COUPON_ERRORS.NOT_FOUND };

    // Normalizar código si se cambia
    if (cambios.codigo) {
        const codigoNorm = cambios.codigo.trim().toUpperCase();
        if (cupones.some((c, i) => c.codigo === codigoNorm && i !== idx)) {
            return { ok: false, error: COUPON_ERRORS.DUPLICATE_CODE };
        }
        cambios.codigo = codigoNorm;
    }

    cupones[idx] = { ...cupones[idx], ...cambios, updatedAt: new Date().toISOString() };
    _save(cupones);
    return { ok: true, cupon: cupones[idx] };
}

/**
 * Alterna el estado activo/inactivo de un cupón. Solo admins.
 * @param {string} couponId
 * @returns {{ ok:boolean, activo?:boolean, error?:string }}
 */
export function toggleCupon(couponId) {
    const session = getSession();
    if (session?.role !== ROLES.ADMIN) {
        return { ok: false, error: COUPON_ERRORS.FORBIDDEN };
    }

    const cupones = _get();
    const idx     = cupones.findIndex(c => c.id === couponId);
    if (idx === -1) return { ok: false, error: COUPON_ERRORS.NOT_FOUND };

    cupones[idx].activo = !cupones[idx].activo;
    _save(cupones);
    return { ok: true, activo: cupones[idx].activo };
}

/**
 * Elimina permanentemente un cupón. Solo admins.
 * @param {string} couponId
 * @returns {{ ok:boolean, error?:string }}
 */
export function eliminarCupon(couponId) {
    const session = getSession();
    if (session?.role !== ROLES.ADMIN) {
        return { ok: false, error: COUPON_ERRORS.FORBIDDEN };
    }

    const cupones = _get();
    if (!cupones.some(c => c.id === couponId)) {
        return { ok: false, error: COUPON_ERRORS.NOT_FOUND };
    }

    _save(cupones.filter(c => c.id !== couponId));
    return { ok: true };
}

/**
 * Valida un código de cupón contra el total del carrito.
 * Devuelve el monto de descuento calculado si es válido.
 *
 * Uso en checkout:
 *   const res = validarCupon('MAYE10', subtotal);
 *   if (res.ok) aplicar res.descuento;
 *
 * @param {string} codigo
 * @param {number} totalCarrito — subtotal antes de envío
 * @returns {{
 *   ok:        boolean,
 *   descuento?: number,   ← COP a descontar
 *   cupon?:    object,
 *   error?:    string,
 *   mensaje?:  string,    ← mensaje legible para el usuario
 * }}
 */
export function validarCupon(codigo, totalCarrito) {
    if (!codigo?.trim()) return { ok: false, error: COUPON_ERRORS.NOT_FOUND };

    const codigoNorm = codigo.trim().toUpperCase();
    const cupones    = _get();
    const cupon      = cupones.find(c => c.codigo === codigoNorm);

    if (!cupon) {
        return { ok: false, error: COUPON_ERRORS.NOT_FOUND,
                 mensaje: 'Código de cupón no válido.' };
    }

    if (!cupon.activo) {
        return { ok: false, error: COUPON_ERRORS.INACTIVE,
                 mensaje: 'Este cupón está inactivo.' };
    }

    if (cupon.fechaVence && new Date(cupon.fechaVence) < new Date()) {
        return { ok: false, error: COUPON_ERRORS.EXPIRED,
                 mensaje: 'Este cupón ha expirado.' };
    }

    if (cupon.usoMaximo !== null && cupon.usosActuales >= cupon.usoMaximo) {
        return { ok: false, error: COUPON_ERRORS.LIMIT_REACHED,
                 mensaje: 'Este cupón ya alcanzó su límite de usos.' };
    }

    if (totalCarrito < cupon.minCompra) {
        return { ok: false, error: COUPON_ERRORS.MIN_PURCHASE,
                 mensaje: `Compra mínima de $${cupon.minCompra.toLocaleString('es-CO')} COP para usar este cupón.` };
    }

    // Calcular descuento
    let descuento = 0;
    if (cupon.tipo === 'porcentaje') {
        descuento = Math.round(totalCarrito * (cupon.valor / 100));
    } else {
        descuento = Math.min(cupon.valor, totalCarrito); // no puede descontar más que el total
    }

    return { ok: true, descuento, cupon,
             mensaje: `Cupón aplicado: ${cupon.tipo === 'porcentaje' ? cupon.valor + '%' : '$' + cupon.valor.toLocaleString('es-CO')} de descuento.` };
}

/**
 * Registra el uso de un cupón tras una compra exitosa.
 * Llamar desde orderService.crearOrden() al finalizar.
 * @param {string} codigo
 */
export function registrarUsoCupon(codigo) {
    if (!codigo) return;
    const cupones = _get();
    const idx     = cupones.findIndex(c => c.codigo === codigo.trim().toUpperCase());
    if (idx === -1) return;
    cupones[idx].usosActuales = (cupones[idx].usosActuales ?? 0) + 1;
    _save(cupones);
}
