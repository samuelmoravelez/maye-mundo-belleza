// src/js/services/authService.js
// Autenticación Supabase Auth + perfiles (profiles)

import Storage from '../../../js/utils/storage.js';
import { supabase } from './supabaseClient.js';

export const AUTH_KEYS = Object.freeze({
    USERS:   'maye_users',
    SESSION: 'maye_session',
});

export const ROLES = Object.freeze({
    ADMIN:  'admin',
    CLIENT: 'client',
});

export const STATUS = Object.freeze({
    ACTIVE:   'active',
    INACTIVE: 'inactive',
});

export const ADMIN_PRINCIPAL_ID = 'admin_001';

export const AUTH_ERRORS = Object.freeze({
    EMAIL_IN_USE:        'EMAIL_IN_USE',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    PASSWORDS_MISMATCH:  'PASSWORDS_MISMATCH',
    WEAK_PASSWORD:       'WEAK_PASSWORD',
    INVALID_EMAIL:       'INVALID_EMAIL',
    EMPTY_FIELDS:        'EMPTY_FIELDS',
    ACCOUNT_INACTIVE:    'ACCOUNT_INACTIVE',
    UNKNOWN:             'UNKNOWN',
});

/** @type {object|null} */
let _cachedSession = null;
/** @type {object[]} */
let _cachedUsers = [];

function _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function _mapDbRole(role) {
    return role === 'admin' ? ROLES.ADMIN : ROLES.CLIENT;
}

function _mapRoleToDb(role) {
    return role === ROLES.ADMIN ? 'admin' : 'cliente';
}

function _buildSession(authUser, profile) {
    return {
        id:       authUser.id,
        name:     profile?.name ?? authUser.user_metadata?.name ?? authUser.email?.split('@')[0] ?? '',
        email:    authUser.email ?? profile?.email ?? '',
        phone:    profile?.phone ?? authUser.user_metadata?.phone ?? '',
        role:     _mapDbRole(profile?.role ?? 'cliente'),
        status:   profile?.status ?? STATUS.ACTIVE,
        loggedAt: new Date().toISOString(),
    };
}

async function _fetchProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    if (error) {
        console.error('[authService] profile:', error.message);
        return null;
    }
    return data;
}

async function _syncSessionFromAuth(session) {
    if (!session?.user) {
        _cachedSession = null;
        Storage.eliminar(AUTH_KEYS.SESSION);
        return null;
    }
    const profile = await _fetchProfile(session.user.id);
    if (profile?.status === STATUS.INACTIVE) {
        await supabase.auth.signOut();
        _cachedSession = null;
        Storage.eliminar(AUTH_KEYS.SESSION);
        return null;
    }
    _cachedSession = _buildSession(session.user, profile);
    Storage.guardar(AUTH_KEYS.SESSION, _cachedSession);
    return _cachedSession;
}

let _authListenerRegistered = false;

/**
 * Restaura sesión Supabase y registra listener (idempotente).
 * Sustituye la semilla local de admin en localStorage.
 */
export async function inicializarAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    await _syncSessionFromAuth(session);

    if (!_authListenerRegistered) {
        _authListenerRegistered = true;
        supabase.auth.onAuthStateChange(async (_event, session) => {
            await _syncSessionFromAuth(session);
        });
    }
}

export async function initAuthSession() {
    return inicializarAdmin();
}

export async function registerClient(data) {
    const { name, email, phone, password, confirmPassword } = data;

    if (!name?.trim() || !email?.trim() || !password || !confirmPassword) {
        return { ok: false, error: AUTH_ERRORS.EMPTY_FIELDS };
    }
    if (!_isValidEmail(email.trim())) {
        return { ok: false, error: AUTH_ERRORS.INVALID_EMAIL };
    }
    if (password !== confirmPassword) {
        return { ok: false, error: AUTH_ERRORS.PASSWORDS_MISMATCH };
    }
    if (password.length < 6) {
        return { ok: false, error: AUTH_ERRORS.WEAK_PASSWORD };
    }

    const emailNorm = email.trim().toLowerCase();
    const { data: signUpData, error } = await supabase.auth.signUp({
        email: emailNorm,
        password,
        options: {
            data: {
                name: name.trim(),
                phone: phone?.trim() ?? '',
            },
        },
    });

    if (error) {
        if (error.message?.toLowerCase().includes('registered')) {
            return { ok: false, error: AUTH_ERRORS.EMAIL_IN_USE };
        }
        return { ok: false, error: AUTH_ERRORS.UNKNOWN };
    }

    if (signUpData.user && !signUpData.session) {
        return {
            ok: false,
            error: AUTH_ERRORS.UNKNOWN,
            mensaje: 'Revisa tu correo para confirmar la cuenta antes de iniciar sesión.',
        };
    }

    await _syncSessionFromAuth(signUpData.session);
    await _afterLoginHooks();

    const { password: _, ...safeUser } = {
        ..._cachedSession,
        createdAt: signUpData.user?.created_at,
    };
    return { ok: true, user: safeUser };
}

export async function login(credentials) {
    const { email, password } = credentials;
    if (!email?.trim() || !password) {
        return { ok: false, error: AUTH_ERRORS.EMPTY_FIELDS };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
    });

    if (error) {
        return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
    }

    const synced = await _syncSessionFromAuth(data.session);
    if (!synced) {
        return { ok: false, error: AUTH_ERRORS.ACCOUNT_INACTIVE };
    }

    await _afterLoginHooks();
    return { ok: true, user: { ..._cachedSession } };
}

async function _afterLoginHooks() {
    if (!_cachedSession?.id) return;
    try {
        const { mergeGuestCartOnLogin, syncCartFromRemote } = await import('./cartService.js');
        await mergeGuestCartOnLogin(_cachedSession.id);
        await syncCartFromRemote();
        const { syncWishlistFromRemote, mergeGuestWishlistOnLogin } = await import('./wishlistService.js');
        await mergeGuestWishlistOnLogin(_cachedSession.id);
        await syncWishlistFromRemote();
    } catch (err) {
        console.error('[authService] post-login sync:', err);
    }
}

export async function logout() {
    await supabase.auth.signOut();
    _cachedSession = null;
    Storage.eliminar(AUTH_KEYS.SESSION);
}

export function getSession() {
    if (_cachedSession) return _cachedSession;
    return Storage.obtener(AUTH_KEYS.SESSION, null);
}

export function getCurrentUser() {
    return getSession();
}

export function isLoggedIn() {
    return getSession() !== null;
}

export function isAdmin() {
    return getSession()?.role === ROLES.ADMIN;
}

export function isClient() {
    return getSession()?.role === ROLES.CLIENT;
}

function _mapProfileToUser(profile) {
    return {
        id:        profile.id,
        name:      profile.name,
        email:     profile.email ?? '',
        phone:     profile.phone ?? '',
        role:      _mapDbRole(profile.role),
        status:    profile.status ?? STATUS.ACTIVE,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
    };
}

/**
 * Lista perfiles (admin). Actualiza caché para lecturas síncronas en dashboard.
 * @returns {Promise<object[]>}
 */
export async function refreshUsersCache() {
    if (!isAdmin()) {
        _cachedUsers = [];
        return [];
    }
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('[authService] list users:', error.message);
        return [];
    }
    _cachedUsers = (data ?? []).map(_mapProfileToUser);
    return _cachedUsers;
}

/** Lectura síncrona de la última caché de usuarios (admin). */
export function getUsersCache() {
    return _cachedUsers.map(u => ({ ...u }));
}

export async function actualizarUsuarioPorAdmin(userId, datos) {
    const sesionActiva = getSession();
    if (sesionActiva?.role !== ROLES.ADMIN) {
        return { ok: false, error: 'FORBIDDEN' };
    }

    const profile = await _fetchProfile(userId);
    if (!profile) return { ok: false, error: 'USER_NOT_FOUND' };

    const name = datos.name?.trim();
    if (!name) return { ok: false, error: AUTH_ERRORS.EMPTY_FIELDS };

    const email = datos.email?.trim().toLowerCase();
    if (!email || !_isValidEmail(email)) {
        return { ok: false, error: AUTH_ERRORS.INVALID_EMAIL };
    }

    const nuevoRol = datos.role ?? _mapDbRole(profile.role);
    if (
        userId === sesionActiva.id &&
        profile.role === 'admin' &&
        nuevoRol !== ROLES.ADMIN
    ) {
        const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'admin')
            .neq('id', userId);
        if ((count ?? 0) === 0) {
            return { ok: false, error: 'LAST_ADMIN' };
        }
    }

    const nuevaPassword = datos.nuevaPassword?.trim();
    if (nuevaPassword && nuevaPassword.length < 6) {
        return { ok: false, error: AUTH_ERRORS.WEAK_PASSWORD };
    }

    const { error: updErr } = await supabase
        .from('profiles')
        .update({
            name,
            email,
            phone: datos.phone?.trim() ?? profile.phone ?? '',
            role: _mapRoleToDb(nuevoRol),
        })
        .eq('id', userId);

    if (updErr) {
        if (updErr.code === '23505') {
            return { ok: false, error: AUTH_ERRORS.EMAIL_IN_USE };
        }
        return { ok: false, error: updErr.message };
    }

    if (nuevaPassword && userId === sesionActiva.id) {
        await supabase.auth.updateUser({ password: nuevaPassword });
    }

    await refreshUsersCache();
    const updated = _cachedUsers.find(u => u.id === userId);
    if (sesionActiva.id === userId && updated) {
        _cachedSession = { ..._cachedSession, ...updated };
        Storage.guardar(AUTH_KEYS.SESSION, _cachedSession);
    }
    return { ok: true, user: updated ?? _mapProfileToUser({ ...profile, name, email }) };
}

export async function toggleUserStatus(userId) {
    const sesion = getSession();
    if (sesion?.role !== ROLES.ADMIN) {
        return { ok: false, error: 'FORBIDDEN' };
    }
    if (userId === sesion.id) return { ok: false, error: 'SELF_ACTION' };

    const profile = await _fetchProfile(userId);
    if (!profile) return { ok: false, error: 'USER_NOT_FOUND' };

    const estadoActual = profile.status ?? STATUS.ACTIVE;
    const nuevoEstado = estadoActual === STATUS.ACTIVE ? STATUS.INACTIVE : STATUS.ACTIVE;

    const { error } = await supabase
        .from('profiles')
        .update({ status: nuevoEstado })
        .eq('id', userId);

    if (error) return { ok: false, error: error.message };

    await refreshUsersCache();
    const user = _cachedUsers.find(u => u.id === userId);
    return { ok: true, user, newStatus: nuevoEstado };
}

export async function updateOwnProfile({ name, phone, address, city }) {
    const sesion = getSession();
    if (!sesion?.id) return { ok: false, error: 'FORBIDDEN' };

    const { error } = await supabase
        .from('profiles')
        .update({
            name: name?.trim() ?? sesion.name,
            phone: phone?.trim() ?? '',
        })
        .eq('id', sesion.id);

    if (error) return { ok: false, error: error.message };

    _cachedSession = {
        ...sesion,
        name: name?.trim() ?? sesion.name,
        phone: phone?.trim() ?? '',
    };
    Storage.guardar(AUTH_KEYS.SESSION, _cachedSession);

    if (address !== undefined || city !== undefined) {
        Storage.guardar('maye_profile_extra', {
            address: address?.trim() ?? '',
            city: city?.trim() ?? '',
        });
    }

    return { ok: true, user: { ..._cachedSession } };
}

export async function deleteUserById(userId, opciones = {}) {
    const sesion = getSession();
    if (sesion?.role !== ROLES.ADMIN) {
        return { ok: false, error: 'FORBIDDEN' };
    }
    if (userId === sesion.id) return { ok: false, error: 'SELF_ACTION' };

    const profile = await _fetchProfile(userId);
    if (!profile) return { ok: false, error: 'USER_NOT_FOUND' };

    const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString(), status: STATUS.INACTIVE })
        .eq('id', userId);

    if (error) return { ok: false, error: error.message };

    if (opciones.limpiarPedidos) {
        await supabase.from('orders').delete().eq('user_id', userId);
    }

    await refreshUsersCache();
    return { ok: true };
}
