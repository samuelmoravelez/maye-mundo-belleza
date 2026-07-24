// js/utils/storage.js
// Responsabilidad: abstrae TODAS las operaciones de localStorage y sessionStorage.
// Soporta primitivos, objetos y arrays (JSON serializado).
// Ningún otro archivo del proyecto debe acceder a window.localStorage
// o window.sessionStorage directamente. Así la futura migración a una
// capa API/backend solo afecta a este módulo.

const TIPOS = Object.freeze({ local: 'local', session: 'session' });

function resolverBackend(tipo) {
    if (tipo === TIPOS.session) return window.sessionStorage;
    return window.localStorage;
}

function deserializar(raw, defaultValue) {
    if (raw === null || raw === undefined) return defaultValue;
    try {
        return JSON.parse(raw);
    } catch {
        // Valor plano (string / número antiguo)
        const numero = Number(raw);
        return isNaN(numero) ? raw : numero;
    }
}

const Storage = {

    TIPOS,

    obtener(clave, defaultValue = null, { tipo = TIPOS.local } = {}) {
        const raw = resolverBackend(tipo).getItem(clave);
        return deserializar(raw, defaultValue);
    },

    guardar(clave, valor, { tipo = TIPOS.local } = {}) {
        resolverBackend(tipo).setItem(clave, JSON.stringify(valor));
    },

    eliminar(clave, { tipo = TIPOS.local } = {}) {
        resolverBackend(tipo).removeItem(clave);
    },

    existe(clave, { tipo = TIPOS.local } = {}) {
        return resolverBackend(tipo).getItem(clave) !== null;
    },

};

export default Storage;
