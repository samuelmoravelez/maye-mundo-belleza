// js/components/authModal.js
// ─────────────────────────────────────────────────────────────────────────────
// Componente UI del Modal de Autenticación — Maye Mundo Belleza
//
// Responsabilidades:
//   - Renderizar el HTML del modal e inyectarlo en el DOM
//   - Controlar apertura/cierre, cambio de pestañas
//   - Validaciones en tiempo real con feedback visual
//   - Delegar lógica de negocio a authService.js
//   - Actualizar el Header según el estado de sesión
// ─────────────────────────────────────────────────────────────────────────────

import {
    registerClient,
    login,
    logout,
    getSession,
    isLoggedIn,
    ROLES,
    AUTH_ERRORS,
} from '../utils/authService.js';
import { RUTAS } from '../utils/constants.js';

// ── Mensajes de error legibles ────────────────────────────────────────────────
const ERROR_MSGS = {
    [AUTH_ERRORS.EMPTY_FIELDS]:        'Por favor completa todos los campos obligatorios.',
    [AUTH_ERRORS.INVALID_EMAIL]:       'Ingresa un correo electrónico válido.',
    [AUTH_ERRORS.PASSWORDS_MISMATCH]:  'Las contraseñas no coinciden.',
    [AUTH_ERRORS.WEAK_PASSWORD]:       'La contraseña debe tener al menos 6 caracteres.',
    [AUTH_ERRORS.EMAIL_IN_USE]:        'Este correo ya está registrado. Intenta iniciar sesión.',
    [AUTH_ERRORS.INVALID_CREDENTIALS]: 'Correo o contraseña incorrectos.',
    [AUTH_ERRORS.UNKNOWN]:             'Ocurrió un error inesperado. Intenta de nuevo.',
};

// ── Template HTML del modal ───────────────────────────────────────────────────
function crearHTMLModal() {
    return /* html */`
<div class="auth-overlay" id="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-modal-titulo" aria-hidden="true">
  <div class="auth-modal" id="auth-modal">

    <!-- Cabecera con gradiente + pestañas -->
    <div class="auth-modal__header">
      <div class="auth-modal__logo">
        <img src="https://res.cloudinary.com/ocnnxclz/image/upload/v1784219028/333_mvofgw.png"
             alt="Maye Mundo Belleza" class="auth-modal__logo-img">
        <span class="auth-modal__logo-nombre">Maye Mundo Belleza</span>
      </div>
      <button class="auth-modal__cerrar" id="auth-modal-cerrar" aria-label="Cerrar modal">
        <i class="ri-close-line"></i>
      </button>
      <div class="auth-tabs" role="tablist">
        <button class="auth-tab auth-tab--activo" id="tab-login"
                role="tab" aria-selected="true" aria-controls="panel-login"
                data-auth-tab="login">
          <i class="ri-login-circle-line"></i> Iniciar Sesión
        </button>
        <button class="auth-tab" id="tab-registro"
                role="tab" aria-selected="false" aria-controls="panel-registro"
                data-auth-tab="registro">
          <i class="ri-user-add-line"></i> Crear Cuenta
        </button>
      </div>
    </div>

    <!-- Cuerpo scrollable -->
    <div class="auth-modal__cuerpo">

      <!-- ── PANEL LOGIN ── -->
      <div class="auth-panel auth-panel--activo" id="panel-login" role="tabpanel" aria-labelledby="tab-login">
        <p class="auth-panel__titulo" id="auth-modal-titulo">¡Bienvenida de nuevo!</p>
        <p class="auth-panel__subtitulo">Ingresa tus datos para continuar</p>

        <div class="auth-alerta" id="login-alerta" role="alert" aria-live="assertive">
          <i class="auth-alerta__icono ri-error-warning-fill"></i>
          <span id="login-alerta-texto"></span>
        </div>

        <form id="form-login-auth" novalidate>
          <div class="auth-campo" id="campo-login-email">
            <label class="auth-campo__label" for="login-email">Correo electrónico</label>
            <div class="auth-campo__wrapper">
              <i class="auth-campo__icono ri-mail-line"></i>
              <input class="auth-campo__input" type="email" id="login-email"
                     name="email" placeholder="tu@correo.com"
                     autocomplete="email" required>
            </div>
            <span class="auth-campo__error-msg">
              <i class="ri-error-warning-line"></i><span></span>
            </span>
          </div>

          <div class="auth-campo" id="campo-login-password">
            <label class="auth-campo__label" for="login-password">Contraseña</label>
            <div class="auth-campo__wrapper">
              <i class="auth-campo__icono ri-lock-line"></i>
              <input class="auth-campo__input auth-campo__input--con-toggle"
                     type="password" id="login-password"
                     name="password" placeholder="••••••••"
                     autocomplete="current-password" required>
              <button type="button" class="auth-campo__toggle-password"
                      aria-label="Mostrar contraseña" data-toggle-for="login-password">
                <i class="ri-eye-line"></i>
              </button>
            </div>
            <span class="auth-campo__error-msg">
              <i class="ri-error-warning-line"></i><span></span>
            </span>
          </div>

          <button type="submit" class="auth-btn-submit" id="btn-login-submit">
            <span class="auth-spinner"></span>
            <span class="auth-btn-submit__texto">
              <i class="ri-login-circle-line"></i> Ingresar
            </span>
          </button>
        </form>

        <div class="auth-separador">¿No tienes cuenta?</div>
        <button type="button" class="auth-btn-submit"
                style="background:transparent;color:var(--verde-principal);box-shadow:none;border:1.5px solid var(--verde-principal);margin-top:0;"
                data-auth-tab-switch="registro">
          Crear cuenta gratis
        </button>
      </div>

      <!-- ── PANEL REGISTRO ── -->
      <div class="auth-panel" id="panel-registro" role="tabpanel" aria-labelledby="tab-registro">
        <p class="auth-panel__titulo">Crea tu cuenta</p>
        <p class="auth-panel__subtitulo">Únete y disfruta de una experiencia personalizada</p>

        <div class="auth-alerta" id="registro-alerta" role="alert" aria-live="assertive">
          <i class="auth-alerta__icono ri-error-warning-fill"></i>
          <span id="registro-alerta-texto"></span>
        </div>

        <form id="form-registro-auth" novalidate>
          <div class="auth-campo" id="campo-reg-nombre">
            <label class="auth-campo__label" for="reg-nombre">Nombre completo</label>
            <div class="auth-campo__wrapper">
              <i class="auth-campo__icono ri-user-3-line"></i>
              <input class="auth-campo__input" type="text" id="reg-nombre"
                     name="name" placeholder="Ej: María López"
                     autocomplete="name" required>
            </div>
            <span class="auth-campo__error-msg">
              <i class="ri-error-warning-line"></i><span></span>
            </span>
          </div>

          <div class="auth-campo" id="campo-reg-email">
            <label class="auth-campo__label" for="reg-email">Correo electrónico</label>
            <div class="auth-campo__wrapper">
              <i class="auth-campo__icono ri-mail-line"></i>
              <input class="auth-campo__input" type="email" id="reg-email"
                     name="email" placeholder="tu@correo.com"
                     autocomplete="email" required>
            </div>
            <span class="auth-campo__error-msg">
              <i class="ri-error-warning-line"></i><span></span>
            </span>
          </div>

          <div class="auth-campo" id="campo-reg-telefono">
            <label class="auth-campo__label" for="reg-telefono">
              Teléfono / WhatsApp <span style="font-weight:400;opacity:.7">(opcional)</span>
            </label>
            <div class="auth-campo__wrapper">
              <i class="auth-campo__icono ri-phone-line"></i>
              <input class="auth-campo__input" type="tel" id="reg-telefono"
                     name="phone" placeholder="+57 300 000 0000"
                     autocomplete="tel">
            </div>
          </div>

          <div class="auth-campo" id="campo-reg-password">
            <label class="auth-campo__label" for="reg-password">Contraseña</label>
            <div class="auth-campo__wrapper">
              <i class="auth-campo__icono ri-lock-line"></i>
              <input class="auth-campo__input auth-campo__input--con-toggle"
                     type="password" id="reg-password"
                     name="password" placeholder="Mínimo 6 caracteres"
                     autocomplete="new-password" required>
              <button type="button" class="auth-campo__toggle-password"
                      aria-label="Mostrar contraseña" data-toggle-for="reg-password">
                <i class="ri-eye-line"></i>
              </button>
            </div>
            <div class="auth-fortaleza" id="fortaleza-password" aria-live="polite">
              <div class="auth-fortaleza__barras">
                <div class="auth-fortaleza__barra"></div>
                <div class="auth-fortaleza__barra"></div>
                <div class="auth-fortaleza__barra"></div>
              </div>
              <span class="auth-fortaleza__texto"></span>
            </div>
            <span class="auth-campo__error-msg">
              <i class="ri-error-warning-line"></i><span></span>
            </span>
          </div>

          <div class="auth-campo" id="campo-reg-confirm">
            <label class="auth-campo__label" for="reg-confirm-password">Confirmar contraseña</label>
            <div class="auth-campo__wrapper">
              <i class="auth-campo__icono ri-lock-2-line"></i>
              <input class="auth-campo__input auth-campo__input--con-toggle"
                     type="password" id="reg-confirm-password"
                     name="confirmPassword" placeholder="Repite tu contraseña"
                     autocomplete="new-password" required>
              <button type="button" class="auth-campo__toggle-password"
                      aria-label="Mostrar contraseña" data-toggle-for="reg-confirm-password">
                <i class="ri-eye-line"></i>
              </button>
            </div>
            <span class="auth-campo__error-msg">
              <i class="ri-error-warning-line"></i><span></span>
            </span>
          </div>

          <button type="submit" class="auth-btn-submit" id="btn-registro-submit">
            <span class="auth-spinner"></span>
            <span class="auth-btn-submit__texto">
              <i class="ri-user-add-line"></i> Crear mi cuenta
            </span>
          </button>
        </form>

        <div class="auth-separador">¿Ya tienes cuenta?</div>
        <button type="button" class="auth-btn-submit"
                style="background:transparent;color:var(--verde-principal);box-shadow:none;border:1.5px solid var(--verde-principal);margin-top:0;"
                data-auth-tab-switch="login">
          Iniciar sesión
        </button>
      </div>

    </div><!-- /.auth-modal__cuerpo -->
  </div><!-- /.auth-modal -->
</div><!-- /.auth-overlay -->`;
}

// ── Template del botón/estado de sesión en el Header ─────────────────────────
function crearHTMLHeaderAuth(session) {
    if (!session) {
        return `
        <button class="btn-auth-header" id="btn-abrir-auth" aria-label="Iniciar sesión o crear cuenta">
          <i class="ri-user-line"></i>
          <span>Ingresar</span>
        </button>`;
    }

    const iniciales = session.name
        .split(' ')
        .slice(0, 2)
        .map(p => p[0]?.toUpperCase() ?? '')
        .join('');

    const rolLabel = session.role === ROLES.ADMIN ? 'Administrador' : 'Cliente';
    const rolClass = session.role === ROLES.ADMIN ? 'auth-dropdown__role--admin' : '';
    const rolIcon  = session.role === ROLES.ADMIN ? 'ri-shield-star-line' : 'ri-user-heart-line';

    const adminLink = session.role === ROLES.ADMIN
        ? `<a href="${RUTAS.DASHBOARD}" class="auth-dropdown__item">
             <i class="ri-settings-4-line"></i> Panel Admin
           </a>`
        : `<a href="${RUTAS.DASHBOARD}" class="auth-dropdown__item">
             <i class="ri-dashboard-3-line"></i> Mi Panel
           </a>`;

    return `
    <div class="auth-header-usuario" id="auth-header-usuario" tabindex="0"
         aria-label="Menú de usuario" aria-haspopup="true" aria-expanded="false">
      <div class="auth-avatar">${iniciales}</div>
      <span>${session.name.split(' ')[0]}</span>
      <i class="ri-arrow-down-s-line" style="font-size:1rem;opacity:.6"></i>

      <div class="auth-user-dropdown" id="auth-user-dropdown" role="menu">
        <div class="auth-dropdown__info">
          <span class="auth-dropdown__nombre">${session.name}</span>
          <span class="auth-dropdown__email">${session.email}</span>
          <span class="auth-dropdown__role ${rolClass}">
            <i class="${rolIcon}"></i> ${rolLabel}
          </span>
        </div>
        ${adminLink}
        <button class="auth-dropdown__item auth-dropdown__item--danger"
                id="btn-logout-header" role="menuitem">
          <i class="ri-logout-box-r-line"></i> Cerrar sesión
        </button>
      </div>
    </div>`;
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function setTabActivo(tabId) {
    const tabs   = document.querySelectorAll('[data-auth-tab]');
    const panels = document.querySelectorAll('.auth-panel');

    tabs.forEach(t => {
        const isActivo = t.dataset.authTab === tabId;
        t.classList.toggle('auth-tab--activo', isActivo);
        t.setAttribute('aria-selected', isActivo);
    });

    panels.forEach(p => {
        const isActivo = p.id === `panel-${tabId}`;
        p.classList.toggle('auth-panel--activo', isActivo);
    });
}

function mostrarAlerta(panelId, mensaje, tipo = 'error') {
    const alerta = document.getElementById(`${panelId}-alerta`);
    const texto  = document.getElementById(`${panelId}-alerta-texto`);
    if (!alerta || !texto) return;

    texto.textContent = mensaje;
    alerta.classList.add('auth-alerta--visible');
    alerta.classList.toggle('auth-alerta--exito', tipo === 'exito');

    const icono = alerta.querySelector('.auth-alerta__icono');
    if (icono) {
        icono.className = `auth-alerta__icono ${
            tipo === 'exito' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'
        }`;
    }
}

function ocultarAlerta(panelId) {
    const alerta = document.getElementById(`${panelId}-alerta`);
    if (alerta) alerta.classList.remove('auth-alerta--visible');
}

function setCampoError(campoId, mensaje) {
    const campo = document.getElementById(`campo-${campoId}`);
    if (!campo) return;
    campo.classList.add('auth-campo--error');
    campo.classList.remove('auth-campo--valido');
    const msgSpan = campo.querySelector('.auth-campo__error-msg span');
    if (msgSpan) msgSpan.textContent = mensaje;
}

function setCampoValido(campoId) {
    const campo = document.getElementById(`campo-${campoId}`);
    if (!campo) return;
    campo.classList.remove('auth-campo--error');
    campo.classList.add('auth-campo--valido');
    const msgSpan = campo.querySelector('.auth-campo__error-msg span');
    if (msgSpan) msgSpan.textContent = '';
}

function resetCampo(campoId) {
    const campo = document.getElementById(`campo-${campoId}`);
    if (!campo) return;
    campo.classList.remove('auth-campo--error', 'auth-campo--valido');
    const msgSpan = campo.querySelector('.auth-campo__error-msg span');
    if (msgSpan) msgSpan.textContent = '';
}

function setBotonCargando(btnId, cargando) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.toggle('auth-btn--cargando', cargando);
    btn.disabled = cargando;
}

// ── Indicador de fortaleza de contraseña ─────────────────────────────────────
function evaluarFortaleza(password) {
    let puntos = 0;
    if (password.length >= 6)  puntos++;
    if (password.length >= 10) puntos++;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) puntos++;
    return puntos; // 0=muy débil, 1=débil, 2=media, 3=fuerte
}

function actualizarFortaleza(password) {
    const contenedor = document.getElementById('fortaleza-password');
    if (!contenedor) return;

    if (!password) {
        contenedor.className = 'auth-fortaleza';
        contenedor.querySelector('.auth-fortaleza__texto').textContent = '';
        return;
    }

    const nivel = evaluarFortaleza(password);
    const niveles = ['', 'auth-fortaleza--debil', 'auth-fortaleza--media', 'auth-fortaleza--fuerte'];
    const textos  = ['', 'Contraseña débil', 'Contraseña regular', 'Contraseña segura'];

    contenedor.className = `auth-fortaleza ${niveles[nivel] || niveles[1]}`;
    contenedor.querySelector('.auth-fortaleza__texto').textContent = textos[nivel] || textos[1];
}

// ── Toggle visibilidad contraseña ─────────────────────────────────────────────
function registrarTogglePassword(container) {
    container.querySelectorAll('[data-toggle-for]').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.toggleFor);
            if (!input) return;
            const mostrar = input.type === 'password';
            input.type = mostrar ? 'text' : 'password';
            btn.querySelector('i').className = mostrar ? 'ri-eye-off-line' : 'ri-eye-line';
            btn.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
        });
    });
}

// ── Actualiza el nodo del header ──────────────────────────────────────────────
function actualizarHeader() {
    const contenedor = document.getElementById('auth-header-slot');
    if (!contenedor) return;

    const session = getSession();
    contenedor.innerHTML = crearHTMLHeaderAuth(session);

    // Botón "Ingresar" → abrir modal
    const btnAbrir = document.getElementById('btn-abrir-auth');
    if (btnAbrir) {
        btnAbrir.addEventListener('click', () => abrirModal());
    }

    // Botón logout en dropdown
    const btnLogout = document.getElementById('btn-logout-header');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await logout();
            actualizarHeader();
            // Disparar evento global para que otras partes de la app reaccionen
            window.dispatchEvent(new CustomEvent('auth:logout'));
        });
    }

    // Toggle dropdown con click / teclado
    const usuarioBtn = document.getElementById('auth-header-usuario');
    if (usuarioBtn) {
        const dropdown = document.getElementById('auth-user-dropdown');

        usuarioBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const abierto = dropdown.classList.toggle('auth-user-dropdown--abierto');
            usuarioBtn.setAttribute('aria-expanded', abierto);
        });

        document.addEventListener('click', (e) => {
            if (!usuarioBtn.contains(e.target)) {
                dropdown.classList.remove('auth-user-dropdown--abierto');
                usuarioBtn.setAttribute('aria-expanded', 'false');
            }
        }, { capture: true });

        usuarioBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdown.classList.remove('auth-user-dropdown--abierto');
                usuarioBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

// ── Handlers de formulario ────────────────────────────────────────────────────

async function manejarLogin(e) {
    e.preventDefault();
    ocultarAlerta('login');

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Validación mínima antes de llamar al servicio
    let hayError = false;
    if (!email) {
        setCampoError('login-email', 'Ingresa tu correo electrónico');
        hayError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setCampoError('login-email', 'Correo electrónico no válido');
        hayError = true;
    } else {
        setCampoValido('login-email');
    }

    if (!password) {
        setCampoError('login-password', 'Ingresa tu contraseña');
        hayError = true;
    } else {
        setCampoValido('login-password');
    }

    if (hayError) return;

    setBotonCargando('btn-login-submit', true);

    try {
        const resultado = await login({ email, password });

        if (!resultado.ok) {
            mostrarAlerta('login', ERROR_MSGS[resultado.error] ?? ERROR_MSGS[AUTH_ERRORS.UNKNOWN]);
            if (resultado.error === AUTH_ERRORS.INVALID_CREDENTIALS) {
                setCampoError('login-password', 'Contraseña incorrecta');
                document.getElementById('login-password').value = '';
                document.getElementById('login-password').focus();
            }
            return;
        }

        // ── Éxito ──────────────────────────────────────────────────────────
        // ADMIN  → redirige al dashboard de gestión inmediatamente.
        // CLIENTE → permanece en la página actual; solo se actualiza el header.
        actualizarHeader();
        cerrarModal();

        if (resultado.user.role === ROLES.ADMIN) {
            window.location.href = RUTAS.DASHBOARD;
        } else {
            // Cliente: actualizar header con "Hola, [Nombre]" y disparar evento
            // para que cualquier componente de la página reaccione si lo necesita.
            window.dispatchEvent(new CustomEvent('auth:login', { detail: resultado.user }));
        }

    } catch (err) {
        console.error('[Auth] Error inesperado en login:', err);
        mostrarAlerta('login', ERROR_MSGS[AUTH_ERRORS.UNKNOWN]);
    } finally {
        setBotonCargando('btn-login-submit', false);
    }
}

async function manejarRegistro(e) {
    e.preventDefault();
    ocultarAlerta('registro');

    const name            = document.getElementById('reg-nombre').value.trim();
    const email           = document.getElementById('reg-email').value.trim();
    const phone           = document.getElementById('reg-telefono').value.trim();
    const password        = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    // Validaciones en tiempo real
    let hayError = false;

    if (!name) {
        setCampoError('reg-nombre', 'Ingresa tu nombre completo');
        hayError = true;
    } else { setCampoValido('reg-nombre'); }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setCampoError('reg-email', 'Ingresa un correo válido');
        hayError = true;
    } else { setCampoValido('reg-email'); }

    if (!password || password.length < 6) {
        setCampoError('reg-password', 'Mínimo 6 caracteres');
        hayError = true;
    } else { setCampoValido('reg-password'); }

    if (!confirmPassword) {
        setCampoError('reg-confirm', 'Confirma tu contraseña');
        hayError = true;
    } else if (password !== confirmPassword) {
        setCampoError('reg-confirm', 'Las contraseñas no coinciden');
        hayError = true;
    } else { setCampoValido('reg-confirm'); }

    if (hayError) return;

    setBotonCargando('btn-registro-submit', true);

    try {
        const resultado = await registerClient({ name, email, phone, password, confirmPassword });

        if (!resultado.ok) {
            mostrarAlerta('registro', ERROR_MSGS[resultado.error] ?? ERROR_MSGS[AUTH_ERRORS.UNKNOWN]);
            if (resultado.error === AUTH_ERRORS.EMAIL_IN_USE) {
                setCampoError('reg-email', 'Este correo ya está registrado');
            }
            return;
        }

        actualizarHeader();
        cerrarModal();
        window.dispatchEvent(new CustomEvent('auth:register', { detail: resultado.user }));

    } catch (err) {
        console.error('[Auth] Error inesperado en registro:', err);
        mostrarAlerta('registro', ERROR_MSGS[AUTH_ERRORS.UNKNOWN]);
    } finally {
        setBotonCargando('btn-registro-submit', false);
    }
}

// ── Apertura / cierre del modal ───────────────────────────────────────────────
export function abrirModal(tabInicial = 'login') {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;

    setTabActivo(tabInicial);
    overlay.classList.add('auth-overlay--visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focus en el primer input del panel activo
    const primerInput = overlay.querySelector(`#panel-${tabInicial} input`);
    setTimeout(() => primerInput?.focus(), 350);
}

export function cerrarModal() {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;

    overlay.classList.remove('auth-overlay--visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    // Limpiar formularios y errores al cerrar
    setTimeout(() => {
        document.getElementById('form-login-auth')?.reset();
        document.getElementById('form-registro-auth')?.reset();
        ['login-email','login-password','reg-nombre','reg-email','reg-password','reg-confirm']
            .forEach(id => resetCampo(id));
        ocultarAlerta('login');
        ocultarAlerta('registro');
        actualizarFortaleza('');
    }, 300);
}

// ── Inicialización del componente ─────────────────────────────────────────────
export function iniciarAuthModal() {
    // 1. Inyectar el modal en el DOM si aún no existe
    if (!document.getElementById('auth-overlay')) {
        document.body.insertAdjacentHTML('beforeend', crearHTMLModal());
    }

    // 2. Actualizar el header con el estado actual de sesión
    actualizarHeader();

    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;

    // 3. Cerrar al hacer clic en el overlay
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cerrarModal();
    });

    // 4. Cerrar con botón X
    document.getElementById('auth-modal-cerrar')
        ?.addEventListener('click', cerrarModal);

    // 5. Cerrar con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('auth-overlay--visible')) {
            cerrarModal();
        }
    });

    // 6. Cambio de pestañas
    overlay.querySelectorAll('[data-auth-tab]').forEach(btn => {
        btn.addEventListener('click', () => setTabActivo(btn.dataset.authTab));
    });

    // 7. Botones "switch tab" (ej: "¿Ya tienes cuenta?")
    overlay.querySelectorAll('[data-auth-tab-switch]').forEach(btn => {
        btn.addEventListener('click', () => setTabActivo(btn.dataset.authTabSwitch));
    });

    // 8. Toggle de contraseña
    registrarTogglePassword(overlay);

    // 9. Submit de formularios
    document.getElementById('form-login-auth')
        ?.addEventListener('submit', manejarLogin);
    document.getElementById('form-registro-auth')
        ?.addEventListener('submit', manejarRegistro);

    // 10. Validación en tiempo real — correo de login
    document.getElementById('login-email')?.addEventListener('blur', (e) => {
        const v = e.target.value.trim();
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
            setCampoError('login-email', 'Correo no válido');
        } else if (v) {
            setCampoValido('login-email');
        }
    });

    // 11. Validación en tiempo real — contraseña de registro
    document.getElementById('reg-password')?.addEventListener('input', (e) => {
        actualizarFortaleza(e.target.value);
        // Re-validar confirmación si ya tiene valor
        const confirm = document.getElementById('reg-confirm-password');
        if (confirm?.value) {
            if (confirm.value !== e.target.value) {
                setCampoError('reg-confirm', 'Las contraseñas no coinciden');
            } else {
                setCampoValido('reg-confirm');
            }
        }
    });

    // 12. Validación en tiempo real — confirmación de contraseña
    document.getElementById('reg-confirm-password')?.addEventListener('input', (e) => {
        const pass = document.getElementById('reg-password')?.value;
        if (e.target.value && e.target.value !== pass) {
            setCampoError('reg-confirm', 'Las contraseñas no coinciden');
        } else if (e.target.value) {
            setCampoValido('reg-confirm');
        }
    });

    // 13. Validación blur — correo de registro
    document.getElementById('reg-email')?.addEventListener('blur', (e) => {
        const v = e.target.value.trim();
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
            setCampoError('reg-email', 'Correo no válido');
        } else if (v) {
            setCampoValido('reg-email');
        }
    });
}
