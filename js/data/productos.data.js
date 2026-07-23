// js/data/productos.data.js
// Fuente de verdad de productos. En producción esto vendría de una API.
// El panel admin lee/escribe en localStorage con la clave 'maye_productos'.
// Si no hay datos en localStorage, se usan estos defaults.

export const STORAGE_KEY = 'maye_productos';

export const CATEGORIAS = [
    { id: 'todos',      label: 'Todos' },
    { id: 'capilar',    label: 'Cuidado Capilar' },
    { id: 'maquillaje', label: 'Maquillaje' },
    { id: 'unas',       label: 'Uñas' },
    { id: 'skincare',   label: 'Skincare' },
];

export const ETIQUETAS = {
    nuevo:       { texto: 'Nuevo',       clase: 'nuevo' },
    popular:     { texto: 'Más vendido', clase: 'popular' },
    oferta:      { texto: 'Oferta',      clase: 'oferta' },
    agotado:     { texto: 'Agotado',     clase: 'agotado' },
};

/** @type {Producto[]} */
export const PRODUCTOS_DEFAULT = [
    {
        id: 1,
        nombre: 'Tratamiento Hidratante Premium',
        categoria: 'capilar',
        precio: 45000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784217237/22_w4x1qk.png',
        etiqueta: 'nuevo',
        visible: true,
        stock: 15,
        descripcion: 'Tratamiento capilar de hidratación profunda para todo tipo de cabello.',
        whatsapp: 'Hola!%20Me%20interesa%20el%20Tratamiento%20Hidratante%20Premium',
    },
    {
        id: 2,
        nombre: 'Labial Mate Larga Duración',
        categoria: 'maquillaje',
        precio: 28000,
        precioAnterior: 35000,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784217490/33_oldm9d.png',
        etiqueta: 'popular',
        visible: true,
        stock: 30,
        descripcion: 'Labial mate de alta pigmentación con fórmula de larga duración.',
        whatsapp: 'Hola!%20Me%20interesa%20el%20Labial%20Mate',
    },
    {
        id: 3,
        nombre: 'Esmalte Efecto Gel Profesional',
        categoria: 'unas',
        precio: 12000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784217905/profesional_fs469j.png',
        etiqueta: null,
        visible: true,
        stock: 50,
        descripcion: 'Esmalte de uñas efecto gel de larga duración en variedad de colores.',
        whatsapp: 'Hola!%20Me%20interesa%20el%20Esmalte%20Efecto%20Gel',
    },
    {
        id: 4,
        nombre: 'Mascarilla Nutritiva Intensiva',
        categoria: 'capilar',
        precio: 38000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239074/30005606_MASCARILLA-CAPILARMASC-NUTRI-500ml-AGRADO_zojmhp.webp',
        etiqueta: null,
        visible: true,
        stock: 20,
        descripcion: 'Mascarilla nutritiva con ingredientes naturales para cabello seco y dañado.',
        whatsapp: 'Hola!%20Me%20interesa%20la%20Mascarilla%20Nutritiva%20Intensiva',
    },
    {
        id: 5,
        nombre: 'Base Cobertura Total',
        categoria: 'maquillaje',
        precio: 55000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239303/base-de-maquillaje-cobertura-loreal-removebg-preview_k6y4sa.png',
        etiqueta: 'nuevo',
        visible: true,
        stock: 12,
        descripcion: 'Base de maquillaje de cobertura total con acabado natural y SPF 15.',
        whatsapp: 'Hola!%20Me%20interesa%20la%20Base%20Cobertura%20Total',
    },
    {
        id: 6,
        nombre: 'Sérum Vitamina C Iluminador',
        categoria: 'skincare',
        precio: 62000,
        precioAnterior: 75000,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239451/1111_kmnrrq.png',
        etiqueta: 'popular',
        visible: true,
        stock: 8,
        descripcion: 'Sérum con vitamina C pura para iluminar y unificar el tono del rostro.',
        whatsapp: 'Hola!%20Me%20interesa%20el%20S%C3%A9rum%20Vitamina%20C',
    },
    {
        id: 7,
        nombre: 'Kit Manicure Profesional Completo',
        categoria: 'unas',
        precio: 35000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239754/222221_ojuxo5.png',
        etiqueta: null,
        visible: true,
        stock: 25,
        descripcion: 'Kit completo de manicure profesional con lima, alicate y accesorios.',
        whatsapp: 'Hola!%20Me%20interesa%20el%20Kit%20Manicure',
    },
    {
        id: 8,
        nombre: 'Aceite de Argán Puro',
        categoria: 'capilar',
        precio: 48000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239871/1111_ja46bu.png',
        etiqueta: null,
        visible: true,
        stock: 18,
        descripcion: 'Aceite de argán 100% puro para nutrición y brillo del cabello.',
        whatsapp: 'Hola!%20Me%20interesa%20el%20Aceite%20de%20Arg%C3%A1n',
    },
    {
        id: 9,
        nombre: 'Crema Hidratante Facial SPF 30',
        categoria: 'skincare',
        precio: 42000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239933/19._facial_moisturising_lotion_am_cp3oxt.png',
        etiqueta: 'nuevo',
        visible: true,
        stock: 10,
        descripcion: 'Crema hidratante facial con protector solar SPF 30 para uso diario.',
        whatsapp: 'Hola!%20Me%20interesa%20la%20Crema%20Hidratante',
    },
];

/**
 * Devuelve los productos desde localStorage o los defaults.
 * @returns {Producto[]}
 */
export function obtenerProductos() {
    const stored = Storage_obtener(STORAGE_KEY, null);
    return stored && Array.isArray(stored) ? stored : PRODUCTOS_DEFAULT;
}

/**
 * Persiste el array de productos en localStorage.
 * @param {Producto[]} productos
 */
export function guardarProductos(productos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(productos));
}

// Importación lazy de Storage para no crear dependencia circular
function Storage_obtener(clave, def) {
    const raw = localStorage.getItem(clave);
    if (raw === null) return def;
    try { return JSON.parse(raw); } catch { return def; }
}

/**
 * Genera un ID único para productos nuevos.
 * @param {Producto[]} productos
 * @returns {number}
 */
export function generarId(productos) {
    return productos.length > 0
        ? Math.max(...productos.map(p => p.id)) + 1
        : 1;
}

/**
 * Formatea precio en COP.
 * @param {number} precio
 * @returns {string}
 */
export function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
    }).format(precio);
}
