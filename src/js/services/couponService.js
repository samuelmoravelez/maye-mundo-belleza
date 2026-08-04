// src/js/services/couponService.js

import { supabase } from './supabaseClient.js';
import { getSession, ROLES, isLoggedIn } from './authService.js';

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

/** @type {object[]} */
let _cache = [];

function _mapRow(row) {
    return {
        id:           row.id,
        codigo:       row.code,
        tipo:         row.type,
        valor:        Number(row.value),
        minCompra:    Number(row.min_purchase ?? 0),
        activo:       row.is_active !== false,
        usoMaximo:    row.max_uses ?? null,
        usosActuales: row.current_uses ?? 0,
        fechaVence:   row.expires_at ?? null,
        descripcion:  row.description ?? '',
        createdAt:    row.created_at,
        updatedAt:    row.updated_at,
    };
}

function _mapToDb(datos) {
    return {
        code:         datos.codigo?.trim().toUpperCase(),
        type:         datos.tipo,
        value:        Number(datos.valor),
        min_purchase: Number(datos.minCompra ?? 0),
        max_uses:     datos.usoMaximo != null ? Number(datos.usoMaximo) : null,
        expires_at:   datos.fechaVence || null,
        description:  datos.descripcion?.trim() ?? '',
        is_active:    datos.activo !== false,
    };
}

export async function refreshCuponesCache() {
    if (!isLoggedIn()) {
        _cache = [];
        return [];
    }

    const session = getSession();
    const query = supabase.from('coupons').select('*').is('deleted_at', null);

    if (session?.role !== ROLES.ADMIN) {
        query.eq('is_active', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
        console.error('[couponService]', error.message);
        return [];
    }
    _cache = (data ?? []).map(_mapRow);
    return _cache;
}

export function obtenerCupones() {
    return _cache.map(c => ({ ...c }));
}

export async function crearCupon(datos) {
    const session = getSession();
    if (session?.role !== ROLES.ADMIN) {
        return { ok: false, error: COUPON_ERRORS.FORBIDDEN };
    }

    if (!datos.codigo?.trim() || !datos.tipo || !datos.valor) {
        return { ok: false, error: COUPON_ERRORS.MISSING_FIELDS };
    }
    if (!['porcentaje', 'fijo'].includes(datos.tipo)) {
        return { ok: false, error: COUPON_ERRORS.MISSING_FIELDS };
    }

    const payload = _mapToDb({ ...datos, activo: true });
    const { data, error } = await supabase
        .from('coupons')
        .insert(payload)
        .select('*')
        .single();

    if (error) {
        if (error.code === '23505') {
            return { ok: false, error: COUPON_ERRORS.DUPLICATE_CODE };
        }
        return { ok: false, error: error.message };
    }

    await refreshCuponesCache();
    return { ok: true, cupon: _mapRow(data) };
}

export async function actualizarCupon(couponId, cambios) {
    const session = getSession();
    if (session?.role !== ROLES.ADMIN) {
        return { ok: false, error: COUPON_ERRORS.FORBIDDEN };
    }

    const dbChanges = {};
    if (cambios.codigo) dbChanges.code = cambios.codigo.trim().toUpperCase();
    if (cambios.tipo) dbChanges.type = cambios.tipo;
    if (cambios.valor != null) dbChanges.value = Number(cambios.valor);
    if (cambios.minCompra != null) dbChanges.min_purchase = Number(cambios.minCompra);
    if (cambios.usoMaximo !== undefined) {
        dbChanges.max_uses = cambios.usoMaximo != null ? Number(cambios.usoMaximo) : null;
    }
    if (cambios.fechaVence !== undefined) dbChanges.expires_at = cambios.fechaVence;
    if (cambios.descripcion != null) dbChanges.description = cambios.descripcion.trim();
    if (cambios.activo != null) dbChanges.is_active = cambios.activo;

    const { data, error } = await supabase
        .from('coupons')
        .update(dbChanges)
        .eq('id', couponId)
        .select('*')
        .maybeSingle();

    if (error) {
        if (error.code === '23505') {
            return { ok: false, error: COUPON_ERRORS.DUPLICATE_CODE };
        }
        return { ok: false, error: error.message };
    }
    if (!data) return { ok: false, error: COUPON_ERRORS.NOT_FOUND };

    await refreshCuponesCache();
    return { ok: true, cupon: _mapRow(data) };
}

export async function toggleCupon(couponId) {
    const session = getSession();
    if (session?.role !== ROLES.ADMIN) {
        return { ok: false, error: COUPON_ERRORS.FORBIDDEN };
    }

    const cupon = _cache.find(c => c.id === couponId);
    if (!cupon) return { ok: false, error: COUPON_ERRORS.NOT_FOUND };

    const { error } = await supabase
        .from('coupons')
        .update({ is_active: !cupon.activo })
        .eq('id', couponId);

    if (error) return { ok: false, error: error.message };
    await refreshCuponesCache();
    const updated = _cache.find(c => c.id === couponId);
    return { ok: true, activo: updated?.activo };
}

export async function eliminarCupon(couponId) {
    const session = getSession();
    if (session?.role !== ROLES.ADMIN) {
        return { ok: false, error: COUPON_ERRORS.FORBIDDEN };
    }

    const { error } = await supabase
        .from('coupons')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', couponId);

    if (error) return { ok: false, error: error.message };
    await refreshCuponesCache();
    return { ok: true };
}

export async function validarCuponAsync(codigo, totalCarrito) {
    if (!isLoggedIn()) {
        return { ok: false, error: COUPON_ERRORS.FORBIDDEN,
            mensaje: 'Inicia sesión para aplicar cupones.' };
    }

    if (_cache.length === 0) await refreshCuponesCache();

    if (!codigo?.trim()) return { ok: false, error: COUPON_ERRORS.NOT_FOUND };

    const codigoNorm = codigo.trim().toUpperCase();
    const { data: row, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', codigoNorm)
        .is('deleted_at', null)
        .maybeSingle();

    const cupon = row ? _mapRow(row) : _cache.find(c => c.codigo === codigoNorm);

    if (error || !cupon) {
        return { ok: false, error: COUPON_ERRORS.NOT_FOUND,
            mensaje: 'Código de cupón no válido.' };
    }

    return _validarCuponObjeto(cupon, totalCarrito);
}

export function validarCupon(codigo, totalCarrito) {
    if (!codigo?.trim()) return { ok: false, error: COUPON_ERRORS.NOT_FOUND };

    const codigoNorm = codigo.trim().toUpperCase();
    const cupon = _cache.find(c => c.codigo === codigoNorm);

    if (!cupon) {
        return { ok: false, error: COUPON_ERRORS.NOT_FOUND,
            mensaje: 'Código de cupón no válido.' };
    }

    return _validarCuponObjeto(cupon, totalCarrito);
}

function _validarCuponObjeto(cupon, totalCarrito) {
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

    let descuento = 0;
    if (cupon.tipo === 'porcentaje') {
        descuento = Math.round(totalCarrito * (cupon.valor / 100));
    } else {
        descuento = Math.min(cupon.valor, totalCarrito);
    }

    return {
        ok: true,
        descuento,
        cupon,
        mensaje: `Cupón aplicado: ${cupon.tipo === 'porcentaje' ? cupon.valor + '%' : '$' + cupon.valor.toLocaleString('es-CO')} de descuento.`,
    };
}

export async function registrarUsoCupon(codigo, orderId, discountApplied = 0) {
    if (!codigo) return;

    const codigoNorm = codigo.trim().toUpperCase();
    const { data: row } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', codigoNorm)
        .maybeSingle();

    if (!row) return;

    await supabase
        .from('coupons')
        .update({ current_uses: (row.current_uses ?? 0) + 1 })
        .eq('id', row.id);

    const session = getSession();
    if (orderId && session?.id) {
        await supabase.from('coupon_redemptions').insert({
            coupon_id: row.id,
            user_id: session.id,
            order_id: orderId,
            discount_applied: discountApplied,
        });
    }

    await refreshCuponesCache();
}
