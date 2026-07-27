// js/components/barraAnuncio.js
// Responsabilidad: rotar automáticamente los mensajes de la barra de anuncio
// usando la fuente de verdad centralizada en constants.js.
// Animación de fade-out / fade-in sutil sin distraer.

import { BARRA_ANUNCIOS } from '../utils/constants.js';

const ROTACION_MS = 3500; // 3.5s por mensaje
const DURACION_FMS = 450; // duración fade

export function iniciarBarraAnuncio() {
    const barra  = document.getElementById('barra-anuncio');
    if (!barra) return;

    const mensajeEl = barra.querySelector('.barra-anuncio__mensaje');
    const izqEl     = barra.querySelector('.barra-anuncio__izq');
    const derEl     = barra.querySelector('.barra-anuncio__der');
    if (!mensajeEl) return;

    // Garantizar transición en CSS (fallback por si global.css no lo tuviera)
    barra.style.setProperty('--barra-fade-ms', `${DURACION_FMS}ms`);

    const mensajes = Array.isArray(BARRA_ANUNCIOS) && BARRA_ANUNCIOS.length > 0
        ? BARRA_ANUNCIOS
        : [{ texto: 'Envíos a todo el país — Escríbenos por WhatsApp',
             iconoIzquierdo: 'ri-truck-line', iconoDerechoFinal: 'ri-whatsapp-line' }];

    let idx = 0;

    function aplicarClaseIcono(el, clase) {
        if (!el) return;
        el.className = 'barra-anuncio__icono ' + (clase || '');
        el.style.visibility = clase ? 'visible' : 'hidden';
    }

    function render() {
        const m = mensajes[idx];
        mensajeEl.style.opacity = '0';
        setTimeout(() => {
            mensajeEl.textContent = m.texto || '';
            aplicarClaseIcono(izqEl, m.iconoIzquierdo || null);
            aplicarClaseIcono(derEl, m.iconoDerechoFinal || null);
            mensajeEl.style.opacity = '1';
        }, DURACION_FMS);
    }

    // Render inicial inmediato (no esperar ROTACION_MS)
    const m0 = mensajes[0];
    mensajeEl.textContent = m0.texto || '';
    aplicarClaseIcono(izqEl, m0.iconoIzquierdo || null);
    aplicarClaseIcono(derEl, m0.iconoDerechoFinal || null);
    mensajeEl.style.transition = `opacity ${DURACION_FMS}ms ease`;

    if (mensajes.length > 1) {
        setInterval(() => {
            idx = (idx + 1) % mensajes.length;
            render();
        }, ROTACION_MS);
    }
}
