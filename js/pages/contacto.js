// js/pages/contacto.js
// Formulario de contacto con Formspree, validación y estados de carga.
// Los mensajes de éxito/error tienen el atributo `hidden` en el HTML
// y este módulo los controla exclusivamente — nunca ambos visibles al mismo tiempo.

const FORMSPREE_URL = 'https://formspree.io/f/mzdnvoyj';
const AUTOOCULTAR_MS = 8000; // ms antes de ocultar el mensaje automáticamente

export function iniciarFormulario() {
    const form = document.querySelector('.contacto-form');
    if (!form) return;

    const btnSubmit = form.querySelector('.btn-form');
    const msgExito  = document.getElementById('form-mensaje-exito');
    const msgError  = document.getElementById('form-mensaje-error');

    // Garantizar que ambos mensajes estén ocultos al iniciar
    ocultarTodo(msgExito, msgError);

    // ── Validación en tiempo real ──────────────────────────────────────────
    form.querySelectorAll('input[required], select[required], textarea[required]')
        .forEach(campo => {
            campo.addEventListener('blur',  () => validarCampo(campo));
            campo.addEventListener('input', () => {
                if (campo.classList.contains('campo-invalido')) validarCampo(campo);
            });
        });

    // ── Envío ──────────────────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validar todos los requeridos antes de enviar
        const requeridos = [...form.querySelectorAll('input[required], select[required], textarea[required]')];
        const todosValidos = requeridos.every(c => validarCampo(c));
        if (!todosValidos) return;

        // Ocultar mensajes previos, activar carga
        ocultarTodo(msgExito, msgError);
        setEstadoCarga(btnSubmit, true);

        try {
            const res = await fetch(FORMSPREE_URL, {
                method:  'POST',
                body:    new FormData(form),
                headers: { Accept: 'application/json' },
            });

            if (res.ok) {
                form.reset();
                limpiarValidaciones(form);
                mostrarMensaje(msgExito);
                // Ocultar el formulario y mostrar solo el mensaje
                form.style.display = 'none';
                // Ocultar automáticamente tras unos segundos (opcional, no oculta el form)
                programarOcultamiento(msgExito, () => {
                    form.style.display = '';
                });
            } else {
                const data   = await res.json().catch(() => ({}));
                const textoError = data?.errors?.map(e => e.message).join(', ')
                    || 'Error al enviar. Por favor intenta de nuevo.';
                mostrarMensaje(msgError, textoError);
                programarOcultamiento(msgError);
            }
        } catch {
            mostrarMensaje(msgError, 'Sin conexión. Revisa tu internet e intenta de nuevo.');
            programarOcultamiento(msgError);
        } finally {
            setEstadoCarga(btnSubmit, false);
        }
    });
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function validarCampo(campo) {
    const errorEl = campo.parentElement?.querySelector('.campo-error');

    if (!campo.value.trim()) {
        marcarInvalido(campo, errorEl, 'Este campo es obligatorio.');
        return false;
    }
    if (campo.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campo.value.trim())) {
        marcarInvalido(campo, errorEl, 'Ingresa un correo electrónico válido.');
        return false;
    }
    if (campo.tagName === 'SELECT' && !campo.value) {
        marcarInvalido(campo, errorEl, 'Selecciona una opción.');
        return false;
    }
    marcarValido(campo, errorEl);
    return true;
}

function marcarInvalido(campo, errorEl, msg) {
    campo.classList.add('campo-invalido');
    campo.classList.remove('campo-valido');
    if (errorEl) errorEl.textContent = msg;
}

function marcarValido(campo, errorEl) {
    campo.classList.remove('campo-invalido');
    campo.classList.add('campo-valido');
    if (errorEl) errorEl.textContent = '';
}

function limpiarValidaciones(form) {
    form.querySelectorAll('.campo-invalido, .campo-valido').forEach(el => {
        el.classList.remove('campo-invalido', 'campo-valido');
    });
    form.querySelectorAll('.campo-error').forEach(el => {
        el.textContent = '';
    });
}

function setEstadoCarga(btn, cargando) {
    if (!btn) return;
    btn.disabled  = cargando;
    btn.innerHTML = cargando
        ? `<span class="btn-spinner"></span> Enviando...`
        : `<i class="ri-send-plane-fill"></i> Enviar mensaje`;
}

function ocultarTodo(...elementos) {
    elementos.forEach(el => {
        if (!el) return;
        el.hidden = true;
        el.classList.remove('visible');
    });
}

function mostrarMensaje(el, texto) {
    if (!el) return;
    if (texto) {
        const textoEl = el.querySelector('[data-texto]');
        if (textoEl) textoEl.textContent = texto;
    }
    // Quitar la clase visible primero para reiniciar la animación si se muestra de nuevo
    el.classList.remove('visible');
    el.hidden = false;
    // Forzar reflow para que la animación reinicie correctamente
    void el.offsetWidth;
    el.classList.add('visible');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

let _autoTimer = null;
function programarOcultamiento(el, callback) {
    if (_autoTimer) clearTimeout(_autoTimer);
    _autoTimer = setTimeout(() => {
        if (el) {
            el.hidden = true;
            el.classList.remove('visible');
        }
        if (callback) callback();
    }, AUTOOCULTAR_MS);
}
