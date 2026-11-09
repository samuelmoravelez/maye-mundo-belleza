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
    CHECKOUT:      'maye_checkout_pendiente',
    COUPONS:       'maye_coupons',
});

/** Claves de sessionStorage para el flujo de pagos (no persisten entre tabs) */
export const PAYMENT_SESSION_KEYS = Object.freeze({
    ULTIMA_ORDEN:    'maye_ultima_orden',
    ORDEN_PENDIENTE: 'maye_orden_pendiente',
});

export const SCHEMA_VERSION = 1;

export const RUTAS = Object.freeze({
    HOME:           '/index.html',
    PRODUCTOS:      '/paginas/productos.html',
    CONTACTO:       '/paginas/contacto.html',
    LEGAL:          '/paginas/legales.html',
    PRODUCTO:       '/paginas/producto.html',
    ADMIN:          '/admin.html',
    DASHBOARD:      '/dashboard.html',
    CARRITO:        '/carrito.html',
    CHECKOUT:       '/checkout.html',
    PEDIDO_EXITOSO: '/pedido-exitoso.html',
    CONFIRMACION:   '/confirmacion.html',
    LOGIN:          '/login.html',
    REGISTER:       '/register.html',
});

// Mercado Pago (Sandbox / Pruebas)
export const MERCADOPAGO_PUBLIC_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MERCADOPAGO_PUBLIC_KEY)
    || 'APP_USR-99d10d96-950f-4ead-a7fb-b4ed189a93dc';

export const MERCADOPAGO_ACCESS_TOKEN = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_MERCADOPAGO_ACCESS_TOKEN || import.meta.env?.MERCADOPAGO_ACCESS_TOKEN))
    || 'APP_USR-1646223387749622-102416-bc0db2e1152dcb370d623c952c2c03a2-3788190103';

// Costo de envío estándar (COP). Cambiar aquí para todo el sistema.
export const SHIPPING_COST = 8000;

/** Umbral de compra (COP) a partir del cual el envío es gratuito */
export const ENVIO_GRATIS_MINIMO = 120_000;

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
