// js/components/whatsappFlotante.js
// Responsabilidad: aplicar el enlace de WhatsApp centralizado
// al botón flotante y a cualquier otro enlace WA dinámico del sitio
// (footer, barra de anuncio, CTA "asesoría", etc.).
// La fuente de verdad es utils/constants.js → waLink().

import { waLink, WHATSAPP_DEFAULT_MESSAGE } from '../utils/constants.js';

export function iniciarWhatsAppDinamico() {
    // 1) Botón flotante
    const flotante = document.getElementById('whatsapp-flotante');
    if (flotante) {
        flotante.href = waLink(WHATSAPP_DEFAULT_MESSAGE);
    }

    // 2) Enlace WhatsApp en el footer
    document.querySelectorAll('a.whatsapp-footer').forEach(a => {
        a.href = waLink(WHATSAPP_DEFAULT_MESSAGE);
    });

    // 3) CTA "Asesoría gratis" del hero
    document.querySelectorAll('[data-cta-whatsapp]').forEach(a => {
        const msg = a.dataset.waMensaje || WHATSAPP_DEFAULT_MESSAGE;
        a.href = waLink(msg);
    });

    // 4) Links legacy hardcodeados en HTML (por si quedara alguno)
    document.querySelectorAll('a[href^="https://wa.me/"], a[href^="https://api.whatsapp.com/"]').forEach(a => {
        // Si ya tiene un mensaje, no lo sobrescribimos (evitar romper CTA
        // específicos como el del detalle de producto).
        if (a.dataset.waGestionado === 'true') return;
        a.dataset.waGestionado = 'true';
    });
}
