// js/data/productos.data.js
// Fuente de verdad de productos. En producción esto vendría de una API.
// El panel admin lee/escribe en localStorage con la clave STORAGE_KEYS.PRODUCTOS.
// Si no hay datos en localStorage, se usan estos defaults.
// TODO acceso a almacenamiento pasa por js/utils/storage.js (centralizado).

import Storage from '../utils/storage.js';
import { STORAGE_KEYS, SCHEMA_VERSION } from '../utils/constants.js';

export const STORAGE_KEY = STORAGE_KEYS.PRODUCTOS;
export const SCHEMA_VERSION_ACTUAL = SCHEMA_VERSION;

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

/**
 * Aplica migraciones / defaults a un producto para que tenga todos los
 * campos nuevos aunque se trate de un producto creado antes de que
 * estos campos existieran (evita errores al renderizar).
 */
function normalizarProducto(p) {
    const base = {
        id: null,
        nombre: '',
        categoria: 'capilar',
        precio: 0,
        precioAnterior: null,
        imagen: '',
        etiqueta: null,
        visible: true,
        stock: 0,
        descripcion: '',
        whatsapp: '',
        // Campos nuevos (para página de detalle):
        marca: '',
        destacado: false,
        sku: null,
        imagenes: [],
        beneficios: [],
        modoUso: [],
        ingredientes: [],
        fechaCreacion: null,
        fechaModificacion: null,
    };
    const merged = Object.assign({}, base, p);
    // Asegurar que arrays lo sean de verdad
    merged.imagenes   = Array.isArray(merged.imagenes)   ? merged.imagenes   : [];
    merged.beneficios = Array.isArray(merged.beneficios) ? merged.beneficios : [];
    merged.modoUso    = Array.isArray(merged.modoUso)    ? merged.modoUso    : [];
    merged.ingredientes = Array.isArray(merged.ingredientes) ? merged.ingredientes : [];
    // Si no hay imagenes extra y sí hay imagen principal, poblar
    if (merged.imagen && merged.imagenes.length === 0) merged.imagenes = [merged.imagen];
    return merged;
}

/** @type {Producto[]} */
export const PRODUCTOS_DEFAULT = [
    normalizarProducto({
        id: 1,
        nombre: 'Tratamiento Hidratante Premium',
        categoria: 'capilar',
        precio: 45000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784217237/22_w4x1qk.png',
        etiqueta: 'nuevo',
        visible: true,
        stock: 15,
        descripcion: 'Tratamiento capilar de hidratación profunda para todo tipo de cabello. Fórmula con keratina y aceite de argán que restaura la fibra capilar dañada en 1 sola aplicación.',
        whatsapp: encodeURIComponent('Hola! Me interesa el Tratamiento Hidratante Premium'),
        marca: 'Maye Professional',
        destacado: true,
        sku: 'MAYE-TRAT-CAP-001',
        beneficios: [
            'Hidratación profunda que dura hasta 15 días',
            'Restaura puntas abiertas y cabello quebradizo',
            'Aporta brillo intenso sin engrasar',
            'Fórmula libre de sulfatos y parabenos',
            'Apto para cabello teñido',
        ],
        modoUso: [
            'Lava el cabello con tu shampoo preferido y retira el exceso de agua con una toalla.',
            'Aplica una cantidad generosa del tratamiento de medios a puntas.',
            'Masajea suavemente durante 2 minutos para asegurar la penetración.',
            'Deja actuar por 10 a 15 minutos (usa un gorro térmico para mejores resultados).',
            'Enjuaga con abundante agua fría o tibia.',
        ],
        ingredientes: ['Agua', 'Keratina hidrolizada', 'Aceite de Argán puro', 'Pantenol (Vitamina B5)', 'Extracto de aloe vera', 'Glicerina vegetal'],
    }),
    normalizarProducto({
        id: 2,
        nombre: 'Labial Mate Larga Duración',
        categoria: 'maquillaje',
        precio: 28000,
        precioAnterior: 35000,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784217490/33_oldm9d.png',
        etiqueta: 'popular',
        visible: true,
        stock: 30,
        descripcion: 'Labial mate de alta pigmentación con fórmula de larga duración. Resiste comidas y bebidas sin cuartearse ni resecar los labios.',
        whatsapp: encodeURIComponent('Hola! Me interesa el Labial Mate'),
        marca: 'Maye Color',
        destacado: true,
        sku: 'MAYE-MAQ-LAB-002',
        beneficios: [
            'Hasta 12 horas de duración',
            'Alta pigmentación en una sola pasada',
            'Fórmula hidratante con manteca de karité',
            'No transfiere ni se cuartea',
            'Apto para veganos',
        ],
        modoUso: [
            'Asegúrate de tener los labios limpios e hidratados.',
            'Aplica desde el centro de los labios hacia los bordes.',
            'Para un acabado perfecto, define el contorno con un delineador de labios del mismo tono.',
        ],
        ingredientes: ['Manteca de karité', 'Vitamina E', 'Cera de carnauba', 'Candelilla wax', 'Pigmentos minerales'],
    }),
    normalizarProducto({
        id: 3,
        nombre: 'Esmalte Efecto Gel Profesional',
        categoria: 'unas',
        precio: 12000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784217905/profesional_fs469j.png',
        etiqueta: null,
        visible: true,
        stock: 50,
        descripcion: 'Esmalte de uñas efecto gel de larga duración en variedad de colores. Acabado brillante profesional sin necesidad de lámpara UV.',
        whatsapp: encodeURIComponent('Hola! Me interesa el Esmalte Efecto Gel'),
        marca: 'Maye Nails',
        destacado: false,
        sku: 'MAYE-UNAS-ESM-003',
        beneficios: [
            'Acabado gel de alta duración',
            'Sin necesidad de lámpara LED/UV',
            'Secado rápido en 60 segundos',
            'Hasta 7 días sin descascarillarse',
            'Fórmula libre de 7 sustancias nocivas',
        ],
        modoUso: [
            'Prepara la uña: limar y retirar cutícula.',
            'Aplica una fina capa de base y deja secar.',
            'Aplica 2 capas del esmalte dejando secar entre cada una.',
            'Finaliza con una capa de top coat para prolongar la duración y el brillo.',
        ],
        ingredientes: ['Acetato de butilo', 'Etil acetato', 'Nitrocelulosa', 'Adherentes polímeros', 'Silicona', 'Filtros UV'],
    }),
    normalizarProducto({
        id: 4,
        nombre: 'Mascarilla Nutritiva Intensiva',
        categoria: 'capilar',
        precio: 38000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239074/30005606_MASCARILLA-CAPILARMASC-NUTRI-500ml-AGRADO_zojmhp.webp',
        etiqueta: null,
        visible: true,
        stock: 20,
        descripcion: 'Mascarilla nutritiva con ingredientes naturales para cabello seco y dañado. Reconstruye la fibra capilar de adentro hacia afuera.',
        whatsapp: encodeURIComponent('Hola! Me interesa la Mascarilla Nutritiva Intensiva'),
        marca: 'Maye Natural',
        destacado: false,
        sku: 'MAYE-TRAT-CAP-004',
        beneficios: [
            'Nutre intensamente el cabello seco',
            'Reduce el frizz en un 90%',
            'Reestructura cabellos muy dañados',
            'Aporta suavidad y manejabilidad',
            'Fragancia dulce y relajante',
        ],
        modoUso: [
            'Después del shampoo, retira el exceso de agua.',
            'Aplica la mascarilla separando el cabello en mechones.',
            'Deja actuar de 15 a 20 minutos.',
            'Enjuaga bien y peina como de costumbre.',
            'Usa 1 vez por semana para mejores resultados.',
        ],
        ingredientes: ['Manteca de coco', 'Aceite de oliva', 'Miel de abeja', 'Aminoácidos', 'Vitamina A', 'Proteínas de trigo'],
    }),
    normalizarProducto({
        id: 5,
        nombre: 'Base Cobertura Total',
        categoria: 'maquillaje',
        precio: 55000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239303/base-de-maquillaje-cobertura-loreal-removebg-preview_k6y4sa.png',
        etiqueta: 'nuevo',
        visible: true,
        stock: 12,
        descripcion: 'Base de maquillaje de cobertura total con acabado natural y SPF 15. Disimula imperfecciones, manchas y ojeras sin efecto máscara.',
        whatsapp: encodeURIComponent('Hola! Me interesa la Base Cobertura Total'),
        marca: 'Maye Color',
        destacado: true,
        sku: 'MAYE-MAQ-BAS-005',
        beneficios: [
            'Cobertura total de larga duración',
            'Protector solar SPF 15',
            'Acabado natural semi-mate',
            'No obstruye los poros (no comedogénica)',
            'Resistente al sudor y la humedad',
        ],
        modoUso: [
            'Aplica tu hidratante facial y primer.',
            'Dispensa una pequeña cantidad en el dorso de la mano.',
            'Extiende con brocha, esponja o dedos desde el centro del rostro hacia afuera.',
            'Difumina bien en la línea de la mandíbula y cuello.',
            'Fija con polvos traslúcidos si deseas mayor duración.',
        ],
        ingredientes: ['Dióxido de titanio (físico UV)', 'Ácido hialurónico', 'Vitamina E', 'Pigmentos tratados', 'Glicerina', 'Silica microfinamente molida'],
    }),
    normalizarProducto({
        id: 6,
        nombre: 'Sérum Vitamina C Iluminador',
        categoria: 'skincare',
        precio: 62000,
        precioAnterior: 75000,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239451/1111_kmnrrq.png',
        etiqueta: 'popular',
        visible: true,
        stock: 8,
        descripcion: 'Sérum con vitamina C pura al 15% para iluminar y unificar el tono del rostro. Reduce manchas, líneas de expresión y aporta antioxidante.',
        whatsapp: encodeURIComponent('Hola! Me interesa el Sérum Vitamina C'),
        marca: 'Maye Derm',
        destacado: true,
        sku: 'MAYE-SKIN-SER-006',
        beneficios: [
            'Vitamina C pura al 15% estabilizada',
            'Desvanece manchas de sol y acné',
            'Unifica el tono de la piel visiblemente',
            'Potente acción antioxidante',
            'Estimula la producción de colágeno',
        ],
        modoUso: [
            'Limpia y tonifica tu rostro por la mañana.',
            'Aplica 4 a 5 gotas del sérum sobre la piel húmeda.',
            'Extiende suavemente con las yemas de los dedos dando golpecitos.',
            'Deja absorber por 1 minuto.',
            'Finaliza con tu hidratante y protector solar de rutina.',
            'Usa vitamina C en la mañana siempre y protector solar después.',
        ],
        ingredientes: ['Ácido ascórbico (Vitamina C pura)', 'Ácido ferúlico', 'Vitamina E', 'Ácido hialurónico', 'Extracto de té verde', 'Agua desionizada'],
    }),
    normalizarProducto({
        id: 7,
        nombre: 'Kit Manicure Profesional Completo',
        categoria: 'unas',
        precio: 35000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239754/222221_ojuxo5.png',
        etiqueta: null,
        visible: true,
        stock: 25,
        descripcion: 'Kit completo de manicure profesional con lima, alicate y accesorios. Todo lo necesario para lucir unas perfectas desde casa.',
        whatsapp: encodeURIComponent('Hola! Me interesa el Kit Manicure'),
        marca: 'Maye Nails',
        destacado: false,
        sku: 'MAYE-UNAS-KIT-007',
        beneficios: [
            '12 herramientas profesionales incluidas',
            'Acero inoxidable de alta calidad',
            'Estuche de viaje resistente',
            'Uso personal y/o semi-profesional',
            'Corta limpio sin astillar las uñas',
        ],
        modoUso: [
            'Hidrata tus manos y retira cutícula con palito de naranjo.',
            'Corta tus uñas al tamaño deseado con el alicate.',
            'Da forma con la lima (siempre en un solo sentido para no debilitar).',
            'Pule la superficie con el bloque pulidor.',
            'Finaliza aplicando esmalte o aceite para cutícula.',
        ],
        ingredientes: ['Acero inoxidable 410', 'Vidrio templado', 'Cuero sintético (estuche)', 'Madera (palito naranjo)'],
    }),
    normalizarProducto({
        id: 8,
        nombre: 'Aceite de Argán Puro',
        categoria: 'capilar',
        precio: 48000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239871/1111_ja46bu.png',
        etiqueta: null,
        visible: true,
        stock: 18,
        descripcion: 'Aceite de argán 100% puro, prensado en frío. Multiuso: nutrición y brillo del cabello, hidratación de cutículas y piel seca.',
        whatsapp: encodeURIComponent('Hola! Me interesa el Aceite de Argán'),
        marca: 'Maye Natural',
        destacado: false,
        sku: 'MAYE-TRAT-OIL-008',
        beneficios: [
            '100% puro, prensado en frío',
            'Origen Marruecos',
            'Rico en vitamina E y antioxidantes',
            'Multiuso: cabello, cuerpo, uñas, rostro',
            'Sin fragancia añadida (fórmula pura)',
        ],
        modoUso: [
            'Para el cabello: aplica 2 a 4 gotas de medios a puntas sobre cabello húmedo o seco.',
            'Para cutículas: 1 gota por uña masajeando suavemente.',
            'Para el rostro y cuerpo: mezcla 1 gota con tu crema hidratante.',
            'Usa diariamente o según necesidad.',
        ],
        ingredientes: ['100% Aceite de Argania spinosa (argán) prensado en frío sin refinar'],
    }),
    normalizarProducto({
        id: 9,
        nombre: 'Crema Hidratante Facial SPF 30',
        categoria: 'skincare',
        precio: 42000,
        precioAnterior: null,
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784239933/19._facial_moisturising_lotion_am_cp3oxt.png',
        etiqueta: 'nuevo',
        visible: true,
        stock: 10,
        descripcion: 'Crema hidratante facial de rápida absorción con protector solar SPF 30 para uso diario. Ideal para piel normal a mixta.',
        whatsapp: encodeURIComponent('Hola! Me interesa la Crema Hidratante'),
        marca: 'Maye Derm',
        destacado: true,
        sku: 'MAYE-SKIN-HID-009',
        beneficios: [
            'Protector solar SPF 30 de amplio espectro',
            'Hidratación 24 horas',
            'Textura ligera no grasosa',
            'Sin aroma, ideal para piel sensible',
            'Apta bajo maquillaje',
        ],
        modoUso: [
            'Por la mañana, después de limpiar y aplicar tu sérum.',
            'Aplica una cantidad generosa en rostro, cuello y escote.',
            'Masajea suavemente hasta completa absorción.',
            'Reaplica cada 3 horas si hay exposición solar directa.',
        ],
        ingredientes: ['Filtros solares UVA/UVB', 'Ácido hialurónico', 'Niacinamida (Vitamina B3)', 'Pantenol', 'Ceramidas', 'Glicerina'],
    }),
];

/**
 * Devuelve los productos desde localStorage o los defaults.
 * @returns {Producto[]}
 */
export function obtenerProductos() {
    try {
        const stored = Storage.obtener(STORAGE_KEY, null);
        if (stored && Array.isArray(stored)) {
            return stored.map(normalizarProducto);
        }
        // Primer uso: guardamos defaults para que el admin pueda editarlos
        Storage.guardar(STORAGE_KEY, PRODUCTOS_DEFAULT);
        return PRODUCTOS_DEFAULT;
    } catch {
        return PRODUCTOS_DEFAULT.map(normalizarProducto);
    }
}

/**
 * Persiste el array de productos en localStorage.
 * Emite el CustomEvent productos-actualizados para informar a todos los módulos.
 * @param {Producto[]} productos
 */
export function guardarProductos(productos) {
    const conVersiones = productos.map(p => {
        const ahora = new Date().toISOString();
        if (!p.fechaCreacion) p.fechaCreacion = ahora;
        p.fechaModificacion = ahora;
        return normalizarProducto(p);
    });
    Storage.guardar(STORAGE_KEY, conVersiones);
    window.dispatchEvent(new CustomEvent('productos-actualizados', { detail: { productos: conVersiones } }));
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
