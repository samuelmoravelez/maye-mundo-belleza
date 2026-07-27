// js/utils/authService.js
// ─────────────────────────────────────────────────────────────────────────────
// Capa de servicio de Autenticación — Maye Mundo Belleza
//
// Responsabilidad única: gestionar usuarios y sesión en localStorage.
// Toda la lógica de auth pasa por aquí; ningún otro módulo toca las
// claves maye_users / maye_session directamente.
//
// ARQUITECTURA ASYNC/AWAIT:
//   Todas las funciones públicas retornan Promises aunque hoy sean síncronas.
//   Así la migración a una API real (Node/Express, Firebase, Supabase) solo
//   requiere cambiar este archivo, sin tocar componentes ni páginas.
// ─────────────────────────────────────────────────────────────────────────────

import Storage from './storage.js';

// ── Claves de almacenamiento ──────────────────────────────────────────────────
export const AUTH_KEYS = Object.freeze({
    USERS:   'maye_users',
    SESSION: 'maye_session',
});

// ── Roles disponibles ─────────────────────────────────────────────────────────
export const ROLES = Object.freeze({
    ADMIN:  'admin',
    CLIENT: 'client',
});

// ── Errores tipados ───────────────────────────────────────────────────────────
export const AUTH_ERRORS = Object.freeze({
    EMAIL_IN_USE:       'EMAIL_IN_USE',
    INVALID_CREDENTIALS:'INVALID_CREDENTIALS',
    PASSWORDS_MISMATCH: 'PASSWORDS_MISMATCH',
    WEAK_PASSWORD:      'WEAK_PASSWORD',
    INVALID_EMAIL:      'INVALID_EMAIL',
    EMPTY_FIELDS:       'EMPTY_FIELDS',
    UNKNOWN:            'UNKNOWN',
});

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Devuelve la lista completa de usuarios registrados */
function _getUsers() {
    return Storage.obtener(AUTH_KEYS.USERS, []);
}

/** Persiste la lista de usuarios */
function _saveUsers(users) {
    Storage.guardar(AUTH_KEYS.USERS, users);
}

/** Genera un ID único simple */
function _generateId() {
    return `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Valida formato de correo electrónico */
function _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Hashea la contraseña de forma reversible-segura para localStorage.
 *  NOTA: en producción real, el hash se hace en el backend (bcrypt/argon2).
 *  Aquí usamos btoa + salt como capa de ofuscación básica. */
function _hashPassword(password) {
    // Simple XOR + base64 — suficiente para localStorage demo.
    // Reemplazar por hashing real cuando se migre a backend.
    const salt = 'maye2025_salt';
    let result = '';
    for (let i = 0; i < password.length; i++) {
        result += String.fromCharCode(
            password.charCodeAt(i) ^ salt.charCodeAt(i % salt.length)
        );
    }
    return btoa(result);
}

/** Verifica contraseña contra el hash almacenado */
function _verifyPassword(password, hash) {
    return _hashPassword(password) === hash;
}

// ── API PÚBLICA ───────────────────────────────────────────────────────────────

/**
 * Registra un nuevo cliente.
 * @param {{ name: string, email: string, phone: string, password: string, confirmPassword: string }} data
 * @returns {Promise<{ ok: boolean, user?: object, error?: string }>}
 */
export async function registerClient(data) {
    const { name, email, phone, password, confirmPassword } = data;

    // Validaciones
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

    const users = _getUsers();
    const emailNorm = email.trim().toLowerCase();

    if (users.some(u => u.email === emailNorm)) {
        return { ok: false, error: AUTH_ERRORS.EMAIL_IN_USE };
    }

    const newUser = {
        id:        _generateId(),
        name:      name.trim(),
        email:     emailNorm,
        phone:     phone?.trim() ?? '',
        password:  _hashPassword(password),
        role:      ROLES.CLIENT,
        createdAt: new Date().toISOString(),
    };

    _saveUsers([...users, newUser]);

    // Iniciar sesión automáticamente tras el registro
    const session = _buildSession(newUser);
    Storage.guardar(AUTH_KEYS.SESSION, session);

    // Devolver usuario sin la contraseña
    const { password: _, ...safeUser } = newUser;
    return { ok: true, user: safeUser };
}

/**
 * Inicia sesión con email + contraseña.
 * Compatible con rol admin y client.
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ ok: boolean, user?: object, error?: string }>}
 */
export async function login(credentials) {
    const { email, password } = credentials;

    if (!email?.trim() || !password) {
        return { ok: false, error: AUTH_ERRORS.EMPTY_FIELDS };
    }

    const emailNorm = email.trim().toLowerCase();
    const users = _getUsers();
    const user = users.find(u => u.email === emailNorm);

    if (!user || !_verifyPassword(password, user.password)) {
        return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
    }

    const session = _buildSession(user);
    Storage.guardar(AUTH_KEYS.SESSION, session);

    const { password: _, ...safeUser } = user;
    return { ok: true, user: safeUser };
}

/**
 * Cierra la sesión activa y limpia maye_session.
 * @returns {Promise<void>}
 */
export async function logout() {
    Storage.eliminar(AUTH_KEYS.SESSION);
}

/**
 * Devuelve el usuario con sesión activa o null.
 * @returns {{ id, name, email, phone, role, loggedAt } | null}
 */
export function getSession() {
    return Storage.obtener(AUTH_KEYS.SESSION, null);
}

/**
 * Indica si hay una sesión activa.
 * @returns {boolean}
 */
export function isLoggedIn() {
    return getSession() !== null;
}

/**
 * Indica si el usuario activo es administrador.
 * @returns {boolean}
 */
export function isAdmin() {
    const session = getSession();
    return session?.role === ROLES.ADMIN;
}

/**
 * Indica si el usuario activo es cliente.
 * @returns {boolean}
 */
export function isClient() {
    const session = getSession();
    return session?.role === ROLES.CLIENT;
}

// ── Helpers de sesión ─────────────────────────────────────────────────────────

function _buildSession(user) {
    return {
        id:       user.id,
        name:     user.name,
        email:    user.email,
        phone:    user.phone ?? '',
        role:     user.role,
        loggedAt: new Date().toISOString(),
    };
}

// ── Inicialización automática del Administrador ───────────────────────────────

/**
 * Verifica si ya existe un admin en maye_users.
 * Si no existe, lo crea con las credenciales por defecto.
 *
 * Se llama una sola vez en el DOMContentLoaded de cada entry point.
 * Es idempotente: si el admin ya existe, no hace nada.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  CREDENCIALES POR DEFECTO — cambiar antes de producción real    │
 * │  Email    : admin@mayebelleza.com                               │
 * │  Password : maye2025                                            │
 * │  Para cambiar: modifica ADMIN_DEFAULTS abajo y haz nuevo deploy │
 * └─────────────────────────────────────────────────────────────────┘
 */
export function inicializarAdmin() {
    // ── Credenciales por defecto ──────────────────────────────────────────────
    // TODO (producción): reemplaza estos valores por variables de entorno
    // o un proceso de setup seguro antes de desplegar en producción real.
    const ADMIN_DEFAULTS = {
        id:       'admin_001',
        name:     'Administrador',
        email:    'admin@mayebelleza.com',
        password: 'maye2025',           // ← Contraseña en texto plano (se hashea abajo)
        phone:    '',
        role:     ROLES.ADMIN,
    };
    // ─────────────────────────────────────────────────────────────────────────

    const users = _getUsers();

    // ¿Ya existe al menos un usuario con role 'admin'? No tocar nada.
    const adminExiste = users.some(u => u.role === ROLES.ADMIN);
    if (adminExiste) return;

    // No hay admin → crear el registro con la contraseña hasheada
    const adminUser = {
        id:        ADMIN_DEFAULTS.id,
        name:      ADMIN_DEFAULTS.name,
        email:     ADMIN_DEFAULTS.email.toLowerCase(),
        phone:     ADMIN_DEFAULTS.phone,
        password:  _hashPassword(ADMIN_DEFAULTS.password),  // nunca se guarda en texto plano
        role:      ADMIN_DEFAULTS.role,
        createdAt: new Date().toISOString(),
    };

    _saveUsers([...users, adminUser]);

    if (typeof console !== 'undefined') {
        console.info('[Maye Auth] Admin inicializado automáticamente en localStorage.');
    }
}
