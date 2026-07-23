// js/utils/storage.js
// Responsabilidad: abstrae todas las operaciones de localStorage.
// Soporta primitivos, objetos y arrays (JSON serializado).

const Storage = {

    // Obtiene un valor. Intenta parsear JSON; si falla, devuelve el string.
    obtener(clave, defaultValue = null) {
        const raw = localStorage.getItem(clave);
        if (raw === null || raw === undefined) return defaultValue;
        try {
            return JSON.parse(raw);
        } catch {
            // Valor plano (string/número antiguo)
            const numero = Number(raw);
            return isNaN(numero) ? raw : numero;
        }
    },

    // Guarda cualquier valor (objeto, array, primitivo).
    guardar(clave, valor) {
        localStorage.setItem(clave, JSON.stringify(valor));
    },

    // Elimina una clave del almacenamiento.
    eliminar(clave) {
        localStorage.removeItem(clave);
    },

    // Verifica si existe una clave.
    existe(clave) {
        return localStorage.getItem(clave) !== null;
    },

};

export default Storage;
