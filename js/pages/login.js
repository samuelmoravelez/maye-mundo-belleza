// js/pages/login.js
// ─────────────────────────────────────────────────────────────────────────────
// Lógica de interacción para la página Split-Screen de Login:
// - Carrusel dinámico interactivo con rotación automática, dots y swipe
// - Validación y envío de formulario de inicio de sesión con authService
// - Toggle ver/ocultar contraseña
// - Manejo de Google OAuth
// - Modal de recuperación de contraseña con Supabase
// ─────────────────────────────────────────────────────────────────────────────

import { login, AUTH_ERRORS, ROLES } from '../utils/authService.js';
import { supabase }                 from '../../src/js/services/supabaseClient.js';
import { RUTAS }                    from '../utils/constants.js';

// ── Array configurable de diapositivas del carrusel ─────────────────────────
export const SLIDES_CARRUSEL = [
    {
        imagen: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=85',
        badge: 'Cuidado Capilar Premium',
        iconoBadge: 'ri-sparkling-fill',
        titulo: 'Fórmulas que nutren y transforman tu cabello',
        descripcion: 'Tratamientos intensivos y keratina que devuelven la vitalidad, sedosidad y fuerza desde la primera aplicación.',
    },
    {
        imagen: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=85',
        badge: 'Skincare & Luminosidad',
        iconoBadge: 'ri-drop-fill',
        titulo: 'El secreto de una piel radiante y saludable',
        descripcion: 'Rutinas faciales avanzadas formuladas para hidratar, proteger y realzar tu belleza natural día tras día.',
    },
    {
        imagen: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=85',
        badge: 'Maquillaje Profesional',
        iconoBadge: 'ri-heart-3-fill',
        titulo: 'Expresa tu estilo con acabados impecables',
        descripcion: 'Bases de alta cobertura, labiales duraderos y tonos en tendencia que resaltan tu personalidad.',
    },
    {
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/f_auto,q_auto,w_1200/v1784423015/maye_trjxjc.png',
        badge: 'Asesoría Personalizada',
        iconoBadge: 'ri-customer-service-2-fill',
        titulo: 'Tu belleza en manos de expertas',
        descripcion: 'Te guiamos de forma cercana para seleccionar los productos idóneos según tus necesidades y tipo de piel.',
    },
];

// Mensajes de error legibles en español
const MENSAJES_ERROR = {
    [AUTH_ERRORS.EMPTY_FIELDS]:        'Por favor completa todos los campos obligatorios.',
    [AUTH_ERRORS.INVALID_EMAIL]:       'Ingresa un correo electrónico con formato válido (ej. tu@correo.com).',
    [AUTH_ERRORS.INVALID_CREDENTIALS]: 'Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.',
    [AUTH_ERRORS.ACCOUNT_INACTIVE]:    'Tu cuenta se encuentra inactiva. Comunícate con soporte para reactivarla.',
    [AUTH_ERRORS.UNKNOWN]:             'Ocurrió un error inesperado al iniciar sesión. Intenta de nuevo en unos momentos.',
};

/**
 * Inicializador principal de la página de Login
 */
export function iniciarLogin() {
    configurarCarrusel(SLIDES_CARRUSEL);
    configurarFormularioLogin();
    configurarTogglePassword();
    configurarSocialLogin();
    configurarModalRecuperacion();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LÓGICA DEL CARRUSEL VISUAL DINÁMICO
// ─────────────────────────────────────────────────────────────────────────────
function configurarCarrusel(slides) {
    const contenedorSlides = document.getElementById('carrusel-slides');
    const contenedorDots   = document.getElementById('carrusel-indicadores');
    const btnPrev          = document.getElementById('carrusel-btn-prev');
    const btnNext          = document.getElementById('carrusel-btn-next');
    const carruselBox      = document.getElementById('carrusel-container');

    if (!contenedorSlides || !slides || slides.length === 0) return;

    let slideActual = 0;
    let timerAutoplay = null;
    const duracionSlide = 5000;

    // Renderizar diapositivas
    contenedorSlides.innerHTML = slides.map((item, index) => `
        <div class="carrusel-slide ${index === 0 ? 'carrusel-slide--active' : ''}" data-slide-index="${index}" role="group" aria-roledescription="slide" aria-label="${index + 1} de ${slides.length}">
            <img src="${item.imagen}" alt="${item.titulo}" class="carrusel-slide__img" loading="${index === 0 ? 'eager' : 'lazy'}">
            <div class="carrusel-overlay"></div>
            <div class="carrusel-caption">
                <span class="carrusel-badge">
                    <i class="${item.iconoBadge || 'ri-sparkling-fill'}"></i>
                    ${item.badge}
                </span>
                <h2 class="carrusel-titulo">${item.titulo}</h2>
                <p class="carrusel-desc">${item.descripcion}</p>
            </div>
        </div>
    `).join('');

    // Renderizar dots
    if (contenedorDots) {
        contenedorDots.innerHTML = slides.map((_, index) => `
            <button type="button" class="carrusel-dot ${index === 0 ? 'carrusel-dot--active' : ''}"
                    data-dot-index="${index}"
                    aria-label="Ir a la diapositiva ${index + 1}">
            </button>
        `).join('');

        // Clic en dots
        contenedorDots.addEventListener('click', (e) => {
            const dot = e.target.closest('[data-dot-index]');
            if (!dot) return;
            const nuevoIndex = parseInt(dot.dataset.dotIndex, 10);
            irASlide(nuevoIndex);
            reiniciarAutoplay();
        });
    }

    function irASlide(index) {
        const total = slides.length;
        slideActual = (index + total) % total;

        const domSlides = contenedorSlides.querySelectorAll('.carrusel-slide');
        domSlides.forEach((slide, i) => {
            slide.classList.toggle('carrusel-slide--active', i === slideActual);
        });

        if (contenedorDots) {
            const domDots = contenedorDots.querySelectorAll('.carrusel-dot');
            domDots.forEach((dot, i) => {
                dot.classList.toggle('carrusel-dot--active', i === slideActual);
            });
        }
    }

    function siguienteSlide() {
        irASlide(slideActual + 1);
    }

    function anteriorSlide() {
        irASlide(slideActual - 1);
    }

    function iniciarAutoplay() {
        detenerAutoplay();
        timerAutoplay = setInterval(siguienteSlide, duracionSlide);
    }

    function detenerAutoplay() {
        if (timerAutoplay) {
            clearInterval(timerAutoplay);
            timerAutoplay = null;
        }
    }

    function reiniciarAutoplay() {
        detenerAutoplay();
        iniciarAutoplay();
    }

    // Controles de flecha
    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            anteriorSlide();
            reiniciarAutoplay();
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            siguienteSlide();
            reiniciarAutoplay();
        });
    }

    // Pausar con hover o focus
    if (carruselBox) {
        carruselBox.addEventListener('mouseenter', detenerAutoplay);
        carruselBox.addEventListener('mouseleave', iniciarAutoplay);
        carruselBox.addEventListener('focusin', detenerAutoplay);
        carruselBox.addEventListener('focusout', iniciarAutoplay);

        // Soporte Swipe táctil
        let touchStartX = 0;
        let touchEndX = 0;

        carruselBox.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        carruselBox.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const swipeDistance = touchEndX - touchStartX;
            if (Math.abs(swipeDistance) > 40) {
                if (swipeDistance < 0) {
                    siguienteSlide();
                } else {
                    anteriorSlide();
                }
                reiniciarAutoplay();
            }
        }, { passive: true });
    }

    // Iniciar autoplay
    iniciarAutoplay();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FORMULARIO DE LOGIN Y VALIDACIONES
// ─────────────────────────────────────────────────────────────────────────────
function configurarFormularioLogin() {
    const form          = document.getElementById('form-login');
    const inputEmail    = document.getElementById('login-email');
    const inputPassword = document.getElementById('login-password');
    const btnSubmit     = document.getElementById('btn-login-submit');

    if (!form || !inputEmail || !inputPassword || !btnSubmit) return;

    // Limpieza de error en tiempo real
    inputEmail.addEventListener('input', () => limpiarCampoError('campo-email'));
    inputPassword.addEventListener('input', () => limpiarCampoError('campo-password'));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        ocultarAlerta();

        const email    = inputEmail.value.trim();
        const password = inputPassword.value;

        // Validación local
        let tieneError = false;

        if (!email) {
            marcarCampoError('campo-email', 'Ingresa tu correo electrónico');
            tieneError = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            marcarCampoError('campo-email', 'Formato de correo no válido');
            tieneError = true;
        }

        if (!password) {
            marcarCampoError('campo-password', 'Ingresa tu contraseña');
            tieneError = true;
        }

        if (tieneError) return;

        // Estado de carga en botón
        setBotonCargando(btnSubmit, true);

        try {
            const resultado = await login({ email, password });

            if (!resultado.ok) {
                const mensaje = MENSAJES_ERROR[resultado.error] || MENSAJES_ERROR[AUTH_ERRORS.UNKNOWN];
                mostrarAlerta(mensaje, 'error');

                if (resultado.error === AUTH_ERRORS.INVALID_CREDENTIALS) {
                    marcarCampoError('campo-password', 'Contraseña incorrecta');
                    inputPassword.value = '';
                    inputPassword.focus();
                }
                return;
            }

            // Inicio de sesión exitoso
            mostrarAlerta('¡Bienvenida de nuevo! Redirigiendo...', 'exito');

            // Resolver redirección adecuada
            setTimeout(() => {
                redireccionarTrasLogin(resultado.user);
            }, 600);

        } catch (error) {
            console.error('[Login] Error inesperado:', error);
            mostrarAlerta(MENSAJES_ERROR[AUTH_ERRORS.UNKNOWN], 'error');
        } finally {
            setBotonCargando(btnSubmit, false);
        }
    });
}

/**
 * Resuelve la URL de redirección según el rol y si existía redirección guardada
 */
function redireccionarTrasLogin(user) {
    const redirectPendiente = sessionStorage.getItem('maye_auth_redirect');
    sessionStorage.removeItem('maye_auth_redirect');

    if (user?.role === ROLES.ADMIN) {
        window.location.href = RUTAS.DASHBOARD;
        return;
    }

    if (redirectPendiente === 'checkout') {
        window.location.href = RUTAS.CHECKOUT;
    } else if (redirectPendiente === 'dashboard') {
        window.location.href = RUTAS.DASHBOARD;
    } else {
        // Por defecto: ir al dashboard o al inicio según la preferencia
        window.location.href = RUTAS.DASHBOARD;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TOGGLE VER / OCULTAR CONTRASEÑA
// ─────────────────────────────────────────────────────────────────────────────
function configurarTogglePassword() {
    const btnToggle     = document.getElementById('btn-toggle-password');
    const inputPassword = document.getElementById('login-password');

    if (!btnToggle || !inputPassword) return;

    btnToggle.addEventListener('click', () => {
        const esPassword = inputPassword.getAttribute('type') === 'password';
        inputPassword.setAttribute('type', esPassword ? 'text' : 'password');

        const icono = btnToggle.querySelector('i');
        if (icono) {
            icono.className = esPassword ? 'ri-eye-off-line' : 'ri-eye-line';
        }

        btnToggle.setAttribute('aria-label', esPassword ? 'Ocultar contraseña' : 'Ver contraseña');
        inputPassword.focus();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GOOGLE OAUTH
// ─────────────────────────────────────────────────────────────────────────────
function configurarSocialLogin() {
    const btnGoogle = document.getElementById('btn-google-login');
    if (!btnGoogle) return;

    btnGoogle.addEventListener('click', async () => {
        try {
            mostrarAlerta('Conectando con Google...', 'exito');
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/dashboard.html',
                },
            });

            if (error) {
                console.error('[Google OAuth] Error:', error.message);
                mostrarAlerta('No se pudo conectar con Google. ' + error.message, 'error');
            }
        } catch (err) {
            console.error('[Google OAuth] Excepción:', err);
            mostrarAlerta('El inicio de sesión con Google requiere credenciales activas de Supabase.', 'error');
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MODAL DE RECUPERACIÓN DE CONTRASEÑA
// ─────────────────────────────────────────────────────────────────────────────
function configurarModalRecuperacion() {
    const linkAbrir   = document.getElementById('link-recuperar-password');
    const modal       = document.getElementById('modal-recuperar');
    const btnCerrar   = document.getElementById('btn-cerrar-recuperar');
    const form        = document.getElementById('form-recuperar');
    const inputEmail  = document.getElementById('recuperar-email');
    const alertaModal = document.getElementById('alerta-recuperar');

    if (!linkAbrir || !modal) return;

    function abrirModal() {
        modal.classList.add('login-modal-overlay--visible');
        modal.setAttribute('aria-hidden', 'false');
        if (inputEmail) {
            // Si ya escribió algo en el form principal, copiarlo
            const emailPrincipal = document.getElementById('login-email')?.value.trim();
            if (emailPrincipal) inputEmail.value = emailPrincipal;
            setTimeout(() => inputEmail.focus(), 150);
        }
    }

    function cerrarModal() {
        modal.classList.remove('login-modal-overlay--visible');
        modal.setAttribute('aria-hidden', 'true');
        if (alertaModal) {
            alertaModal.style.display = 'none';
        }
    }

    linkAbrir.addEventListener('click', (e) => {
        e.preventDefault();
        abrirModal();
    });

    if (btnCerrar) {
        btnCerrar.addEventListener('click', cerrarModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('login-modal-overlay--visible')) {
            cerrarModal();
        }
    });

    if (form && inputEmail) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = inputEmail.value.trim();

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                mostrarAlertaModal('Por favor ingresa un correo electrónico válido', 'error');
                return;
            }

            const btnSubmit = form.querySelector('button[type="submit"]');
            if (btnSubmit) btnSubmit.disabled = true;

            try {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/login.html',
                });

                if (error) {
                    mostrarAlertaModal('Error: ' + error.message, 'error');
                } else {
                    mostrarAlertaModal('¡Enlace enviado! Revisa tu bandeja de entrada para restablecer tu contraseña.', 'exito');
                    setTimeout(cerrarModal, 3000);
                }
            } catch (err) {
                mostrarAlertaModal('No se pudo enviar el correo de recuperación en este momento.', 'error');
            } finally {
                if (btnSubmit) btnSubmit.disabled = false;
            }
        });
    }

    function mostrarAlertaModal(msg, tipo) {
        if (!alertaModal) return;
        alertaModal.className = `login-alerta login-alerta--${tipo}`;
        alertaModal.innerHTML = `
            <i class="${tipo === 'exito' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}"></i>
            <span>${msg}</span>
        `;
        alertaModal.style.display = 'flex';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES UI DE FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────
function marcarCampoError(campoId, mensaje) {
    const contenedor = document.getElementById(campoId);
    if (!contenedor) return;
    contenedor.classList.add('form-campo--error');
    const msgEl = contenedor.querySelector('.campo-error-msg span');
    if (msgEl) msgEl.textContent = mensaje;
}

function limpiarCampoError(campoId) {
    const contenedor = document.getElementById(campoId);
    if (!contenedor) return;
    contenedor.classList.remove('form-campo--error');
}

function mostrarAlerta(mensaje, tipo = 'error') {
    const alerta = document.getElementById('login-alerta');
    const texto  = document.getElementById('login-alerta-texto');
    const icono  = document.getElementById('login-alerta-icono');

    if (!alerta || !texto) return;

    alerta.className = `login-alerta login-alerta--${tipo}`;
    texto.textContent = mensaje;

    if (icono) {
        icono.className = tipo === 'exito' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill';
    }

    alerta.style.display = 'flex';
}

function ocultarAlerta() {
    const alerta = document.getElementById('login-alerta');
    if (alerta) alerta.style.display = 'none';
}

function setBotonCargando(btn, cargando) {
    btn.disabled = cargando;
    const txt = btn.querySelector('.btn-texto');
    const ldr = btn.querySelector('.btn-loader');
    if (txt) txt.style.display = cargando ? 'none' : 'inline-flex';
    if (ldr) ldr.style.display = cargando ? 'inline-flex' : 'none';
}
