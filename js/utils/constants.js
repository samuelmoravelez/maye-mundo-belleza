// js/utils/constants.js
// Responsabilidad: constantes globales centralizadas del proyecto.
// Cualquier valor hardcodeado que aparezca en múltiples archivos
// debe vivir aquí para que su modificación sea en un único lugar.

export const WA_NUMBER = '573003091641';

export const WHATSAPP_DEFAULT_MESSAGE = encodeURIComponent(
    'Hola! Vi tu página web y quiero hacer una consulta.'
);

export const STORAGE_KEYS = Object.freeze({
    PRODUCTOS:     'maye_productos',
    CARRITO:       'maye_carrito',
    ADMIN_SESSION: 'maye_admin_session',
    USERS:         'maye_users',
    SESSION:       'maye_session',
    ORDERS:        'maye_orders',
    FAVORITES:     'maye_favorites',
    CHECKOUT:      'maye_checkout_pendiente', // carrito snapshot al ir al checkout
});

export const SCHEMA_VERSION = 1;

export const RUTAS = Object.freeze({
    HOME:           '/maye-mundo-belleza/index.html',
    PRODUCTOS:      '/maye-mundo-belleza/paginas/productos.html',
    CONTACTO:       '/maye-mundo-belleza/paginas/contacto.html',
    LEGAL:          '/maye-mundo-belleza/paginas/legales.html',
    PRODUCTO:       '/maye-mundo-belleza/paginas/producto.html',
    ADMIN:          '/maye-mundo-belleza/admin.html',
    DASHBOARD:      '/maye-mundo-belleza/dashboard.html',
    CHECKOUT:       '/maye-mundo-belleza/checkout.html',
    PEDIDO_EXITOSO: '/maye-mundo-belleza/pedido-exitoso.html',
});

// Costo de envío estándar (COP). Cambiar aquí para todo el sistema.
export const SHIPPING_COST = 8000;

export const EMPRESA = Object.freeze({
    NOMBRE:      'Maye Mundo Belleza',
    UBICACION:   'Medellín, Colombia',
    TELEFONO:    '+57 300 309 1641',
    EMAIL:       'mayemundobelleza@gmail.com',
    HORARIOS:    'Lun–Sáb: 9am – 7pm',
    ANIO_FUNDACION: '2025',
    REDES: {
        INSTAGRAM: 'https://www.instagram.com/mayemundo_belleza1',
        TIKTOK:    'https://www.tiktok.com/@mundo.belleza.bello',
    },
});

export const BARRA_ANUNCIOS = Object.freeze([
    {
        iconoDerecho: null,
        iconoIzquierdo: 'ri-truck-line',
        texto: 'Envíos a toda Colombia — Escríbenos por WhatsApp',
        iconoDerechoFinal: 'ri-whatsapp-line',
    },
    {
        iconoIzquierdo: 'ri-customer-service-2-line',
        texto: 'Atención personalizada — Asesoría gratuita por WhatsApp',
        iconoDerechoFinal: 'ri-whatsapp-line',
    },
    {
        iconoIzquierdo: 'ri-time-line',
        texto: 'Horarios de atención: Lun a Sáb 9am – 7pm',
        iconoDerechoFinal: null,
    },
    {
        iconoIzquierdo: 'ri-percent-line',
        texto: 'Promociones especiales — Descubre nuestros descuentos del mes',
        iconoDerechoFinal: null,
    },
    {
        iconoIzquierdo: 'ri-sparkling-2-line',
        texto: 'Nuevos productos disponibles — ¡Explora la nueva colección!',
        iconoDerechoFinal: null,
    },
]);

export function waLink(mensaje) {
    const m = mensaje !== undefined && mensaje !== null && String(mensaje).length > 0
        ? String(mensaje)
        : WHATSAPP_DEFAULT_MESSAGE;
    return `https://wa.me/${WA_NUMBER}?text=${m}`;
}
