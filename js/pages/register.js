// js/pages/register.js
// ─────────────────────────────────────────────────────────────────────────────
// Lógica de interacción para la página Split-Screen de Registro:
// - Carrusel dinámico adaptativo enfocado en beneficios para nuevos miembros
// - Validación integral de formulario en tiempo real
// - Selector internacional de código de país
// - Verificación de coincidencia y requisito mínimo (8 caracteres) de contraseña
// - Integración con Supabase Auth y sincronización con profiles
// - Toggle ver/ocultar contraseñas
// - Registro social con Google OAuth
// ─────────────────────────────────────────────────────────────────────────────

import { registerClient, AUTH_ERRORS, ROLES } from '../utils/authService.js';
import { supabase }                           from '../../src/js/services/supabaseClient.js';
import { RUTAS }                              from '../utils/constants.js';

// ── Slides del carrusel orientadas a nuevos miembros ────────────────────────
export const SLIDES_CARRUSEL = [
    {
        imagen: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=85',
        badge: 'Bienvenida Exclusiva',
        iconoBadge: 'ri-gift-line',
        titulo: 'Bienvenida a Maye Mundo Belleza',
        descripcion: 'Únete a nuestra comunidad de belleza y disfruta de una experiencia pensada para resaltar tu brillo natural cada día.',
    },
    {
        imagen: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=85',
        badge: 'Cuidado Integral',
        iconoBadge: 'ri-sparkling-fill',
        titulo: 'Descubre productos seleccionados para el cuidado de tu piel y cabello',
        descripcion: 'Tratamientos y fórmulas de calidad garantizada para que diseñes tu rutina perfecta con total tranquilidad.',
    },
    {
        imagen: 'https://res.cloudinary.com/ocnnxclz/image/upload/f_auto,q_auto,w_1200/v1784423015/maye_trjxjc.png',
        badge: 'Asesoría Personalizada',
        iconoBadge: 'ri-customer-service-2-fill',
        titulo: 'Asesoría experta a tu alcance',
        descripcion: 'Nuestro equipo de especialistas te acompaña y aconseja para que elijas siempre lo idóneo según tus necesidades.',
    },
    {
        imagen: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=85',
        badge: 'Beneficios de Miembro',
        iconoBadge: 'ri-vip-diamond-line',
        titulo: 'Compras seguras y seguimiento en tiempo real',
        descripcion: 'Accede a historial de pedidos, favoritos y recibe tus envíos de manera rápida y segura en toda Colombia.',
    },
];

// Mensajes de error legibles en español
const MENSAJES_ERROR = {
    [AUTH_ERRORS.EMPTY_FIELDS]:        'Por favor completa todos los campos obligatorios.',
    [AUTH_ERRORS.INVALID_EMAIL]:       'Ingresa un correo electrónico con formato válido (ej. tu@correo.com).',
    [AUTH_ERRORS.PASSWORDS_MISMATCH]:  'Las contraseñas no coinciden. Por favor verifícalas.',
    [AUTH_ERRORS.WEAK_PASSWORD]:       'La contraseña debe tener al menos 8 caracteres.',
    [AUTH_ERRORS.EMAIL_IN_USE]:        'Este correo electrónico ya se encuentra registrado. ¿Deseas iniciar sesión?',
    [AUTH_ERRORS.UNKNOWN]:             'Ocurrió un problema al crear tu cuenta. Intenta de nuevo en unos momentos.',
};

/**
 * Inicializador principal de la página de Registro
 */
export function iniciarRegister() {
    configurarCarrusel(SLIDES_CARRUSEL);
    configurarFormularioRegistro();
    configurarTogglePasswords();
    configurarSocialLogin();
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
        <div class="carrusel-slide ${index === 0 ? 'carrusel-slide--active' : ''}"
             data-slide-index="${index}"
             role="group"
             aria-roledescription="slide"
             aria-label="${index + 1} de ${slides.length}">
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

    iniciarAutoplay();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FORMULARIO DE REGISTRO Y VALIDACIONES
// ─────────────────────────────────────────────────────────────────────────────
function configurarFormularioRegistro() {
    const form                 = document.getElementById('form-register');
    const inputNombre          = document.getElementById('register-nombre');
    const inputEmail           = document.getElementById('register-email');
    const selectPrefix         = document.getElementById('register-phone-prefix');
    const inputTelefono        = document.getElementById('register-telefono');
    const inputPassword        = document.getElementById('register-password');
    const inputConfirmPassword = document.getElementById('register-confirm-password');
    const checkboxTerminos     = document.getElementById('register-terminos');
    const requisitoPassword    = document.getElementById('requisito-password');
    const btnSubmit            = document.getElementById('btn-register-submit');

    if (!form || !inputNombre || !inputEmail || !inputPassword || !inputConfirmPassword || !btnSubmit) return;

    // ── Validaciones y limpieza de errores en tiempo real ────────────────────
    inputNombre.addEventListener('input', () => limpiarCampoError('campo-nombre'));

    inputEmail.addEventListener('input', () => {
        limpiarCampoError('campo-email');
    });

    if (inputTelefono) {
        // Solo permitir números y caracteres de espaciado común
        inputTelefono.addEventListener('input', () => {
            limpiarCampoError('campo-telefono');
            inputTelefono.value = inputTelefono.value.replace(/[^\d\s-]/g, '');
        });
    }

    // Indicador dinámico del requisito de 8 caracteres
    inputPassword.addEventListener('input', () => {
        limpiarCampoError('campo-password');
        const pass = inputPassword.value;
        const reqIcon = requisitoPassword?.querySelector('i');

        if (pass.length >= 8) {
            requisitoPassword?.classList.add('password-requisito--valido');
            requisitoPassword?.classList.remove('password-requisito--invalido');
            if (reqIcon) reqIcon.className = 'ri-checkbox-circle-fill';
        } else if (pass.length > 0) {
            requisitoPassword?.classList.remove('password-requisito--valido');
            requisitoPassword?.classList.add('password-requisito--invalido');
            if (reqIcon) reqIcon.className = 'ri-close-circle-line';
        } else {
            requisitoPassword?.classList.remove('password-requisito--valido', 'password-requisito--invalido');
            if (reqIcon) reqIcon.className = 'ri-information-line';
        }

        // Si ya había ingresado confirmar contraseña, revalidar coincidencia
        if (inputConfirmPassword.value.length > 0) {
            if (inputConfirmPassword.value === pass) {
                limpiarCampoError('campo-confirm-password');
            }
        }
    });

    inputConfirmPassword.addEventListener('input', () => {
        limpiarCampoError('campo-confirm-password');
        if (inputConfirmPassword.value.length > 0 && inputConfirmPassword.value === inputPassword.value) {
            limpiarCampoError('campo-confirm-password');
        }
    });

    if (checkboxTerminos) {
        checkboxTerminos.addEventListener('change', () => {
            limpiarCampoError('campo-terminos');
        });
    }

    // ── Manejo de Submit ─────────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        ocultarAlerta();

        const name            = inputNombre.value.trim();
        const email           = inputEmail.value.trim();
        const prefix          = selectPrefix ? selectPrefix.value : '+57';
        const rawPhone        = inputTelefono ? inputTelefono.value.trim() : '';
        const phoneDigits     = rawPhone.replace(/\D/g, '');
        const password        = inputPassword.value;
        const confirmPassword = inputConfirmPassword.value;
        const aceptoTerminos  = checkboxTerminos ? checkboxTerminos.checked : false;

        let tieneError = false;
        let primerCampoConError = null;

        // 1. Nombre completo
        if (!name || name.length < 2) {
            marcarCampoError('campo-nombre', 'Ingresa tu nombre completo');
            tieneError = true;
            if (!primerCampoConError) primerCampoConError = inputNombre;
        }

        // 2. Correo electrónico
        if (!email) {
            marcarCampoError('campo-email', 'Ingresa tu correo electrónico');
            tieneError = true;
            if (!primerCampoConError) primerCampoConError = inputEmail;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            marcarCampoError('campo-email', 'Ingresa un correo electrónico válido');
            tieneError = true;
            if (!primerCampoConError) primerCampoConError = inputEmail;
        }

        // 3. Teléfono móvil
        if (!rawPhone || phoneDigits.length < 7 || phoneDigits.length > 15) {
            marcarCampoError('campo-telefono', 'Ingresa un número de celular válido (ej. 300 123 4567)');
            tieneError = true;
            if (!primerCampoConError) primerCampoConError = inputTelefono;
        }

        // 4. Contraseña (mínimo 8 caracteres)
        if (!password) {
            marcarCampoError('campo-password', 'Ingresa una contraseña');
            tieneError = true;
            if (!primerCampoConError) primerCampoConError = inputPassword;
        } else if (password.length < 8) {
            marcarCampoError('campo-password', 'La contraseña debe tener al menos 8 caracteres');
            tieneError = true;
            if (!primerCampoConError) primerCampoConError = inputPassword;
        }

        // 5. Confirmar contraseña
        if (!confirmPassword) {
            marcarCampoError('campo-confirm-password', 'Confirma tu contraseña');
            tieneError = true;
            if (!primerCampoConError) primerCampoConError = inputConfirmPassword;
        } else if (password !== confirmPassword) {
            marcarCampoError('campo-confirm-password', 'Las contraseñas no coinciden');
            tieneError = true;
            if (!primerCampoConError) primerCampoConError = inputConfirmPassword;
        }

        // 6. Términos y condiciones
        if (!aceptoTerminos) {
            marcarCampoError('campo-terminos', 'Debes aceptar los términos y condiciones para crear tu cuenta');
            tieneError = true;
            if (!primerCampoConError && checkboxTerminos) primerCampoConError = checkboxTerminos;
        }

        if (tieneError) {
            mostrarAlerta('Por favor revisa y corrige los campos señalados en el formulario.', 'error');
            if (primerCampoConError && typeof primerCampoConError.focus === 'function') {
                primerCampoConError.focus();
            }
            return;
        }

        // Construir teléfono completo internacional
        const telefonoCompleto = `${prefix} ${phoneDigits}`;

        // Activar spinner en botón
        setBotonCargando(btnSubmit, true);

        try {
            const resultado = await registerClient({
                name,
                email,
                phone: telefonoCompleto,
                password,
                confirmPassword,
            });

            if (!resultado.ok) {
                const mensaje = resultado.mensaje || MENSAJES_ERROR[resultado.error] || MENSAJES_ERROR[AUTH_ERRORS.UNKNOWN];
                mostrarAlerta(mensaje, 'error');

                if (resultado.error === AUTH_ERRORS.EMAIL_IN_USE) {
                    marcarCampoError('campo-email', 'Este correo ya se encuentra registrado');
                    inputEmail.focus();
                } else if (resultado.error === AUTH_ERRORS.WEAK_PASSWORD) {
                    marcarCampoError('campo-password', 'Mínimo 8 caracteres');
                    inputPassword.focus();
                } else if (resultado.error === AUTH_ERRORS.PASSWORDS_MISMATCH) {
                    marcarCampoError('campo-confirm-password', 'Las contraseñas no coinciden');
                    inputConfirmPassword.focus();
                }
                return;
            }

            // Caso A: Requiere confirmación por correo electrónico
            if (resultado.requiresEmailConfirmation) {
                mostrarAlerta('¡Registro exitoso! Te hemos enviado un enlace a tu correo para confirmar tu cuenta. Redirigiendo a inicio de sesión...', 'exito');
                deshabilitarFormulario(form);
                setTimeout(() => {
                    window.location.href = RUTAS.LOGIN;
                }, 3000);
                return;
            }

            // Caso B: Sesión iniciada automáticamente
            mostrarAlerta('¡Bienvenida a Maye Mundo Belleza! Tu cuenta ha sido creada exitosamente. Redirigiendo...', 'exito');
            deshabilitarFormulario(form);

            // Disparar evento global de registro
            window.dispatchEvent(new CustomEvent('auth:register', { detail: resultado.user }));

            // Redirección suave
            setTimeout(() => {
                redireccionarTrasRegistro(resultado.user);
            }, 900);

        } catch (error) {
            console.error('[Register] Error inesperado:', error);
            mostrarAlerta(MENSAJES_ERROR[AUTH_ERRORS.UNKNOWN], 'error');
        } finally {
            setBotonCargando(btnSubmit, false);
        }
    });
}

/**
 * Resuelve la URL de redirección adecuada tras el registro
 */
function redireccionarTrasRegistro(user) {
    const redirectPendiente = sessionStorage.getItem('maye_auth_redirect');
    sessionStorage.removeItem('maye_auth_redirect');

    if (redirectPendiente === 'checkout') {
        window.location.href = RUTAS.CHECKOUT;
        return;
    }

    if (user?.role === ROLES.ADMIN) {
        window.location.href = RUTAS.DASHBOARD;
        return;
    }

    window.location.href = RUTAS.DASHBOARD;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TOGGLE VER / OCULTAR CONTRASEÑAS (PASSWORD & CONFIRM PASSWORD)
// ─────────────────────────────────────────────────────────────────────────────
function configurarTogglePasswords() {
    configurarToggleIndividual('btn-toggle-password', 'register-password');
    configurarToggleIndividual('btn-toggle-confirm-password', 'register-confirm-password');
}

function configurarToggleIndividual(btnId, inputId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);

    if (!btn || !input) return;

    btn.addEventListener('click', () => {
        const esPassword = input.getAttribute('type') === 'password';
        input.setAttribute('type', esPassword ? 'text' : 'password');

        const icono = btn.querySelector('i');
        if (icono) {
            icono.className = esPassword ? 'ri-eye-off-line' : 'ri-eye-line';
        }

        btn.setAttribute('aria-label', esPassword ? 'Ocultar contraseña' : 'Ver contraseña');
        input.focus();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. REGISTRO SOCIAL CON GOOGLE OAUTH
// ─────────────────────────────────────────────────────────────────────────────
function configurarSocialLogin() {
    const btnGoogle = document.getElementById('btn-google-register');
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
                console.error('[Google OAuth Register] Error:', error.message);
                mostrarAlerta('No se pudo conectar con Google. ' + error.message, 'error');
            }
        } catch (err) {
            console.error('[Google OAuth Register] Excepción:', err);
            mostrarAlerta('El inicio de sesión con Google requiere credenciales activas de Supabase.', 'error');
        }
    });
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
    const alerta = document.getElementById('register-alerta');
    const texto  = document.getElementById('register-alerta-texto');
    const icono  = document.getElementById('register-alerta-icono');

    if (!alerta || !texto) return;

    alerta.className = `login-alerta login-alerta--${tipo}`;
    texto.textContent = mensaje;

    if (icono) {
        icono.className = tipo === 'exito' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill';
    }

    alerta.style.display = 'flex';
}

function ocultarAlerta() {
    const alerta = document.getElementById('register-alerta');
    if (alerta) alerta.style.display = 'none';
}

function setBotonCargando(btn, cargando) {
    btn.disabled = cargando;
    const txt = btn.querySelector('.btn-texto');
    const ldr = btn.querySelector('.btn-loader');
    if (txt) txt.style.display = cargando ? 'none' : 'inline-flex';
    if (ldr) ldr.style.display = cargando ? 'inline-flex' : 'none';
}

function deshabilitarFormulario(form) {
    const elementos = form.querySelectorAll('input, select, button');
    elementos.forEach(el => {
        el.disabled = true;
    });
}
