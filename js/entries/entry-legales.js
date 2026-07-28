// js/entries/entry-legales.js
// ─────────────────────────────────────────────────────────────────────────────
// Lógica interactiva de paginas/legales.html
//
// Responsabilidades:
//   1. Motor de pestañas (tabs) — muestra/oculta paneles, actualiza aria-attrs
//   2. Tiempo estimado de lectura por pestaña
//   3. Sincronización con URL hash (#envios, #faq, etc.)
//   4. Sincronización selector móvil ↔ pestañas desktop
//   5. Smooth-scroll para los índices internos de cada panel
//   6. Botón "Volver arriba" (back-to-top)
//   7. Botón "Imprimir / PDF"
//   8. Auth modal + carrito compartidos
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/legales.css';
import '../../css/auth.css';

import '../main.js';
import { iniciarAuthModal } from '../components/authModal.js';
import { inicializarAdmin } from '../utils/authService.js';

// ── Mapa de hash de sección → ID de pestaña ───────────────────────────────
// Permite que legales.html#privacidad abra la pestaña correcta aunque el
// panel tenga un id distinto (ej. el footer enlaza a #privacidad).
const HASH_A_TAB = {
    // Hashes del footer
    privacidad:   'privacidad',
    terminos:     'terminos',
    envios:       'envios',
    devoluciones: 'devoluciones',
    faq:          'faq',
    // Aliases de ids internos de secciones (tc-objeto, pv-datos…)
    // → abren la pestaña padre
    'tc-objeto':       'terminos',
    'tc-productos':    'terminos',
    'tc-compra':       'terminos',
    'tc-pago':         'terminos',
    'tc-propiedad':    'terminos',
    'tc-responsabilidad': 'terminos',
    'tc-modificaciones':  'terminos',
    'pv-responsable':  'privacidad',
    'pv-datos':        'privacidad',
    'pv-finalidad':    'privacidad',
    'pv-seguridad':    'privacidad',
    'pv-derechos':     'privacidad',
    'pv-cookies':      'privacidad',
    'en-cobertura':    'envios',
    'en-tiempos':      'envios',
    'en-costos':       'envios',
    'en-proceso':      'envios',
    'en-fallida':      'envios',
    'dv-retracto':     'devoluciones',
    'dv-defectuoso':   'devoluciones',
    'dv-noaplica':     'devoluciones',
    'dv-proceso':      'devoluciones',
    'dv-reembolso':    'devoluciones',
};

// Velocidad de lectura promedio (palabras por minuto)
const WPM = 200;

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE PESTAÑAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Activa la pestaña con el id dado y muestra su panel.
 * También actualiza el selector móvil y el hash de la URL sin recargar.
 *
 * @param {string} tabId - valor del atributo data-tab (ej. 'privacidad')
 * @param {boolean} [scrollTop=false] - hacer scroll suave al inicio del panel
 */
function activarTab(tabId, scrollTop = false) {
    const tabs   = document.querySelectorAll('.legales-tab[data-tab]');
    const panels = document.querySelectorAll('.legales-panel[id^="panel-"]');

    if (!tabs.length || !panels.length) return;

    // 1. Actualizar estado de pestañas
    tabs.forEach(tab => {
        const activo = tab.dataset.tab === tabId;
        tab.classList.toggle('legales-tab--activo', activo);
        tab.setAttribute('aria-selected', activo ? 'true' : 'false');
        tab.setAttribute('tabindex', activo ? '0' : '-1');
    });

    // 2. Mostrar/ocultar paneles con el atributo hidden (no display:none inline)
    panels.forEach(panel => {
        const panelTab = panel.id.replace('panel-', '');
        if (panelTab === tabId) {
            panel.removeAttribute('hidden');
            // Re-disparar animación de entrada
            panel.style.animation = 'none';
            panel.offsetHeight; // reflow
            panel.style.animation = '';
        } else {
            panel.setAttribute('hidden', '');
        }
    });

    // 3. Sincronizar selector móvil
    const select = document.getElementById('legales-select-movil');
    if (select && select.value !== tabId) {
        select.value = tabId;
    }

    // 4. Actualizar hash URL sin saltar la página (history.replaceState)
    history.replaceState(null, '', `#${tabId}`);

    // 5. Scroll opcional al inicio del panel
    if (scrollTop) {
        const panel = document.getElementById(`panel-${tabId}`);
        panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TIEMPO ESTIMADO DE LECTURA
// ─────────────────────────────────────────────────────────────────────────────
function calcularTiempoLectura(tabId) {
    const panel = document.getElementById(`panel-${tabId}`);
    if (!panel) return '';
    const texto    = panel.innerText ?? panel.textContent ?? '';
    const palabras = texto.trim().split(/\s+/).filter(Boolean).length;
    const minutos  = Math.max(1, Math.round(palabras / WPM));
    return `${minutos} min`;
}

function poblarTiemposLectura() {
    const tabs = ['terminos', 'privacidad', 'envios', 'devoluciones', 'faq'];
    tabs.forEach(id => {
        const el = document.getElementById(`tiempo-${id}`);
        if (el) el.textContent = calcularTiempoLectura(id);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SMOOTH SCROLL PARA ÍNDICES INTERNOS
// ─────────────────────────────────────────────────────────────────────────────
function registrarIndices() {
    document.querySelectorAll('.legales-indice__lista a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const targetId = a.getAttribute('href').slice(1);
            const target   = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTÓN VOLVER ARRIBA
// ─────────────────────────────────────────────────────────────────────────────
function registrarBackTop() {
    const btn = document.getElementById('btn-back-top');
    if (!btn) return;

    const UMBRAL = 400;

    const actualizarVisibilidad = () => {
        if (window.scrollY > UMBRAL) {
            btn.removeAttribute('hidden');
        } else {
            btn.setAttribute('hidden', '');
        }
    };

    window.addEventListener('scroll', actualizarVisibilidad, { passive: true });
    actualizarVisibilidad(); // estado inicial

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTÓN IMPRIMIR / PDF
// ─────────────────────────────────────────────────────────────────────────────
function registrarPrint() {
    document.getElementById('btn-imprimir-legales')?.addEventListener('click', () => {
        window.print();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECTOR MÓVIL
// ─────────────────────────────────────────────────────────────────────────────
function registrarSelectMovil() {
    const select = document.getElementById('legales-select-movil');
    if (!select) return;
    select.addEventListener('change', () => {
        activarTab(select.value, true);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PESTAÑAS — eventos de clic y teclado (accesibilidad)
// ─────────────────────────────────────────────────────────────────────────────
function registrarTabs() {
    const tabs = Array.from(document.querySelectorAll('.legales-tab[data-tab]'));
    if (!tabs.length) return;

    tabs.forEach((tab, idx) => {
        // Clic
        tab.addEventListener('click', () => {
            activarTab(tab.dataset.tab, false);
        });

        // Teclado: flechas izquierda/derecha, Home, End (ARIA Authoring Practices)
        tab.addEventListener('keydown', e => {
            let siguiente = null;
            if (e.key === 'ArrowRight') {
                siguiente = tabs[(idx + 1) % tabs.length];
            } else if (e.key === 'ArrowLeft') {
                siguiente = tabs[(idx - 1 + tabs.length) % tabs.length];
            } else if (e.key === 'Home') {
                siguiente = tabs[0];
            } else if (e.key === 'End') {
                siguiente = tabs[tabs.length - 1];
            }
            if (siguiente) {
                e.preventDefault();
                activarTab(siguiente.dataset.tab, false);
                siguiente.focus();
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVER HASH INICIAL (URL o window.location.hash)
// ─────────────────────────────────────────────────────────────────────────────
function resolverHashInicial() {
    const hash = window.location.hash.replace('#', '').trim();
    if (!hash) return 'terminos'; // pestaña por defecto

    // Buscar en el mapa de hashes
    const tabId = HASH_A_TAB[hash] ?? null;
    if (tabId) return tabId;

    // Si el hash coincide exactamente con un id de pestaña
    const panelIds = ['terminos', 'privacidad', 'envios', 'devoluciones', 'faq'];
    if (panelIds.includes(hash)) return hash;

    return 'terminos';
}

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL INTERNO A SUBSECCIÓN TRAS ACTIVAR TAB (para hashes de sección)
// Ej: #en-tiempos → abre panel envios → scroll a #en-tiempos
// ─────────────────────────────────────────────────────────────────────────────
function scrollASubseccion() {
    const hash = window.location.hash.replace('#', '').trim();
    if (!hash || !HASH_A_TAB[hash]) return; // es un hash de pestaña, no de subsección
    // Solo hacer scroll si es un hash de subsección (no de panel raíz)
    const panelIds = ['terminos', 'privacidad', 'envios', 'devoluciones', 'faq'];
    if (panelIds.includes(hash)) return;

    setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Shared: admin seed + auth modal
    inicializarAdmin();
    iniciarAuthModal();

    // 1. Registrar interacciones
    registrarTabs();
    registrarSelectMovil();
    registrarIndices();
    registrarBackTop();
    registrarPrint();

    // 2. Tiempos de lectura (tras render del DOM)
    poblarTiemposLectura();

    // 3. Activar pestaña inicial (hash o defecto)
    const tabInicial = resolverHashInicial();
    activarTab(tabInicial, false);

    // 4. Scroll a subsección si el hash apunta a una sección interna
    scrollASubseccion();
});
