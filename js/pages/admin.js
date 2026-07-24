// js/pages/admin.js
// Panel de Administración — CRUD completo con Storage centralizado.
// Credenciales demo: usuario: admin / contraseña: maye2025

import {
    obtenerProductos,
    guardarProductos,
    generarId,
    formatearPrecio,
    CATEGORIAS,
    ETIQUETAS,
} from '../data/productos.data.js';
import Storage from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';

// ── CREDENCIALES (frontend-only, simuladas) ──────────────────────────────────
const CREDENCIALES = { usuario: 'admin', password: 'maye2025' };
const SESSION_KEY  = STORAGE_KEYS.ADMIN_SESSION;

// ── ESTADO ────────────────────────────────────────────────────────────────────
let productos         = [];
let productoAEliminar = null;
let filtroTexto       = '';
let toastTimer        = null;

// ── INICIALIZACIÓN PRINCIPAL ──────────────────────────────────────────────────
// IMPORTANTE: todos los querySelector se hacen AQUÍ, no en el top-level del
// módulo, para evitar que fallen cuando los elementos todavía no existen.
export function iniciarAdmin() {

    // ── Elementos DOM (resueltos al iniciar, no al cargar el módulo) ──
    const pantallaLogin   = document.getElementById('pantalla-login');
    const panelAdmin      = document.getElementById('panel-admin');
    const formLogin       = document.getElementById('form-login');
    const loginError      = document.getElementById('login-error');
    const btnLogout       = document.getElementById('btn-logout');
    const tablaCuerpo     = document.getElementById('admin-tabla-body');
    const buscarInput     = document.getElementById('admin-buscar-input');
    const btnNuevo        = document.getElementById('btn-nuevo-producto');
    const modalOverlay    = document.getElementById('modal-overlay');
    const modalTitulo     = document.getElementById('modal-titulo');
    const formProducto    = document.getElementById('form-producto');
    const modalCerrar     = document.getElementById('modal-cerrar');
    const modalCancelar   = document.getElementById('modal-cancelar');
    const confirmOverlay  = document.getElementById('confirm-overlay');
    const confirmSi       = document.getElementById('confirm-si');
    const confirmCancelar = document.getElementById('confirm-cancelar');
    // CORRECCIÓN: ID correcto era 'admin-toast' (antes tenía 'anpm run devdmin-toast')
    const toastEl         = document.getElementById('admin-toast');
    const toastTexto      = document.getElementById('toast-texto');
    const toastIcono      = document.getElementById('toast-icono');
    const statTotal       = document.getElementById('stat-total');
    const statVisibles    = document.getElementById('stat-visibles');
    const statAgotados    = document.getElementById('stat-agotados');
    const statOcultos     = document.getElementById('stat-ocultos');

    // ── Helpers internos con acceso al DOM ──────────────────────────────────

    function mostrarPanel() {
        pantallaLogin.style.display = 'none';
        panelAdmin.style.display    = 'flex';
        cargarProductos();
    }

    function cerrarSesion() {
        Storage.eliminar(SESSION_KEY, { tipo: Storage.TIPOS.session });
        panelAdmin.style.display    = 'none';
        pantallaLogin.style.display = 'flex';
        document.getElementById('admin-usuario').value  = '';
        document.getElementById('admin-password').value = '';
    }

    function cargarProductos() {
        productos = obtenerProductos();
        renderizarTabla();
        actualizarStats();
    }

    function renderizarTabla() {
        const filtrados = filtroTexto
            ? productos.filter(p =>
                p.nombre.toLowerCase().includes(filtroTexto) ||
                p.categoria.toLowerCase().includes(filtroTexto))
            : productos;

        if (filtrados.length === 0) {
            tablaCuerpo.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center;padding:48px;color:var(--texto-mutado)">
                        <i class="ri-inbox-line" style="font-size:2.5rem;display:block;margin-bottom:12px;opacity:.4"></i>
                        No se encontraron productos
                    </td>
                </tr>`;
            return;
        }

        tablaCuerpo.innerHTML = filtrados.map(p => filaProducto(p)).join('');

        tablaCuerpo.querySelectorAll('[data-accion]').forEach(btn => {
            btn.addEventListener('click', () => {
                const accion = btn.dataset.accion;
                const id     = Number(btn.dataset.id);
                if (accion === 'editar')   abrirModal(id);
                if (accion === 'toggle')   toggleVisibilidad(id);
                if (accion === 'eliminar') pedirConfirmacion(id);
            });
        });
    }

    function filaProducto(p) {
        const catLabel = CATEGORIAS.find(c => c.id === p.categoria)?.label ?? p.categoria;
        const etLabel  = p.etiqueta ? (ETIQUETAS[p.etiqueta]?.texto ?? p.etiqueta) : '—';
        const agotado  = p.stock === 0;

        let badgeClase = p.visible ? 'admin-badge--visible' : 'admin-badge--oculto';
        let badgeTexto = p.visible ? 'Visible' : 'Oculto';
        if (agotado) { badgeClase = 'admin-badge--agotado'; badgeTexto = 'Agotado'; }

        return `
        <tr>
            <td>
                <img src="${p.imagen}" alt="${p.nombre}" class="admin-tabla__img"
                     onerror="this.src='https://placehold.co/52x52/FAF7F2/2A8C64?text=?'">
            </td>
            <td><div class="admin-tabla__nombre">${p.nombre}</div></td>
            <td class="admin-tabla__cat">${catLabel}</td>
            <td><span class="admin-tabla__precio">${formatearPrecio(p.precio)}</span></td>
            <td class="${p.stock === 0 ? 'admin-tabla__stock--cero' : 'admin-tabla__stock'}">${p.stock}</td>
            <td class="admin-tabla__etiqueta">${etLabel}</td>
            <td><span class="admin-badge ${badgeClase}">${badgeTexto}</span></td>
            <td>
                <div class="admin-acciones">
                    <button class="btn-admin-accion btn-admin-accion--editar"
                            data-accion="editar" data-id="${p.id}" title="Editar">
                        <i class="ri-pencil-line"></i>
                    </button>
                    <button class="btn-admin-accion btn-admin-accion--toggle"
                            data-accion="toggle" data-id="${p.id}"
                            title="${p.visible ? 'Ocultar' : 'Mostrar'}">
                        <i class="ri-eye${p.visible ? '-off' : ''}-line"></i>
                    </button>
                    <button class="btn-admin-accion btn-admin-accion--eliminar"
                            data-accion="eliminar" data-id="${p.id}" title="Eliminar">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }

    function actualizarStats() {
        statTotal.textContent    = productos.length;
        statVisibles.textContent = productos.filter(p => p.visible).length;
        statAgotados.textContent = productos.filter(p => p.stock === 0).length;
        statOcultos.textContent  = productos.filter(p => !p.visible).length;
    }

    // ── MODAL ────────────────────────────────────────────────────────────────
    function abrirModal(id = null) {
        formProducto.reset();
        document.getElementById('producto-id').value = '';

        if (id !== null) {
            const p = productos.find(prod => prod.id === id);
            if (!p) return;
            modalTitulo.textContent                              = 'Editar producto';
            document.getElementById('producto-id').value        = p.id;
            document.getElementById('p-nombre').value           = p.nombre;
            document.getElementById('p-categoria').value        = p.categoria;
            document.getElementById('p-precio').value           = p.precio;
            document.getElementById('p-precio-anterior').value  = p.precioAnterior ?? '';
            document.getElementById('p-stock').value            = p.stock;
            document.getElementById('p-etiqueta').value         = p.etiqueta ?? '';
            document.getElementById('p-imagen').value           = p.imagen;
            document.getElementById('p-descripcion').value      = p.descripcion ?? '';
            document.getElementById('p-whatsapp').value         = p.whatsapp ?? '';
        } else {
            modalTitulo.textContent = 'Nuevo producto';
        }

        modalOverlay.classList.remove('oculto');
        setTimeout(() => document.getElementById('p-nombre').focus(), 100);
    }

    function cerrarModal() {
        modalOverlay.classList.add('oculto');
        formProducto.reset();
    }

    function guardarProducto() {
        const nombre    = document.getElementById('p-nombre').value.trim();
        const categoria = document.getElementById('p-categoria').value;
        const precio    = Number(document.getElementById('p-precio').value);
        const precioAnt = document.getElementById('p-precio-anterior').value;
        const stock     = Number(document.getElementById('p-stock').value) || 0;
        const etiqueta  = document.getElementById('p-etiqueta').value || null;
        const imagen    = document.getElementById('p-imagen').value.trim();
        const desc      = document.getElementById('p-descripcion').value.trim();
        const wa        = document.getElementById('p-whatsapp').value.trim();
        const idGuardado = document.getElementById('producto-id').value;

        if (!nombre || !categoria || !precio || !imagen) {
            mostrarToast('Completa los campos obligatorios (*)', 'error');
            return;
        }

        if (idGuardado) {
            const idx = productos.findIndex(p => p.id === Number(idGuardado));
            if (idx !== -1) {
                productos[idx] = {
                    ...productos[idx],
                    nombre, categoria, precio,
                    precioAnterior: precioAnt ? Number(precioAnt) : null,
                    stock, etiqueta, imagen,
                    descripcion: desc,
                    whatsapp: wa || `Hola!%20Me%20interesa%20${encodeURIComponent(nombre)}`,
                };
            }
            mostrarToast('Producto actualizado correctamente');
        } else {
            productos.push({
                id:            generarId(productos),
                nombre, categoria, precio,
                precioAnterior: precioAnt ? Number(precioAnt) : null,
                stock, etiqueta, imagen,
                descripcion:   desc,
                whatsapp:      wa || `Hola!%20Me%20interesa%20${encodeURIComponent(nombre)}`,
                visible:       true,
            });
            mostrarToast('Producto creado correctamente');
        }

        guardarProductos(productos);
        renderizarTabla();
        actualizarStats();
        cerrarModal();
        window.dispatchEvent(new CustomEvent('productos-actualizados'));
    }

    // ── ACCIONES ─────────────────────────────────────────────────────────────
    function toggleVisibilidad(id) {
        const idx = productos.findIndex(p => p.id === id);
        if (idx === -1) return;
        productos[idx].visible = !productos[idx].visible;
        guardarProductos(productos);
        renderizarTabla();
        actualizarStats();
        mostrarToast(`Producto marcado como ${productos[idx].visible ? 'visible' : 'oculto'}`);
        window.dispatchEvent(new CustomEvent('productos-actualizados'));
    }

    function pedirConfirmacion(id) {
        productoAEliminar = id;
        confirmOverlay.classList.remove('oculto');
    }

    function cerrarConfirm() {
        confirmOverlay.classList.add('oculto');
        productoAEliminar = null;
    }

    // ── TOAST ─────────────────────────────────────────────────────────────────
    function mostrarToast(texto, tipo = 'exito') {
        if (!toastEl) return; // guard por si el elemento no existe
        toastTexto.textContent = texto;
        toastIcono.className   = tipo === 'error'
            ? 'ri-error-warning-line'
            : 'ri-checkbox-circle-fill';
        toastEl.className = `admin-toast${tipo === 'error' ? ' admin-toast--error' : ''}`;

        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.add('oculto'), 3500);
    }

    // ── REGISTRO DE EVENTOS ───────────────────────────────────────────────────

    // Si ya tiene sesión, ir directo al panel
    if (Storage.obtener(SESSION_KEY, false, { tipo: Storage.TIPOS.session }) === true) mostrarPanel();

    formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('admin-usuario').value.trim();
        const p = document.getElementById('admin-password').value;
        if (u === CREDENCIALES.usuario && p === CREDENCIALES.password) {
            Storage.guardar(SESSION_KEY, 'true', { tipo: Storage.TIPOS.session });
            loginError.classList.remove('visible');
            mostrarPanel();
        } else {
            loginError.classList.add('visible');
            document.getElementById('admin-password').value = '';
            document.getElementById('admin-password').focus();
        }
    });

    btnLogout.addEventListener('click', cerrarSesion);

    buscarInput.addEventListener('input', (e) => {
        filtroTexto = e.target.value.toLowerCase();
        renderizarTabla();
    });

    btnNuevo.addEventListener('click', () => abrirModal());

    modalCerrar.addEventListener('click', cerrarModal);
    modalCancelar.addEventListener('click', cerrarModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) cerrarModal();
    });

    formProducto.addEventListener('submit', (e) => {
        e.preventDefault();
        guardarProducto();
    });

    confirmSi.addEventListener('click', () => {
        if (productoAEliminar !== null) {
            productos = productos.filter(p => p.id !== productoAEliminar);
            guardarProductos(productos);
            renderizarTabla();
            actualizarStats();
            cerrarConfirm();
            mostrarToast('Producto eliminado correctamente');
            productoAEliminar = null;
            window.dispatchEvent(new CustomEvent('productos-actualizados'));
        }
    });

    confirmCancelar.addEventListener('click', cerrarConfirm);
    confirmOverlay.addEventListener('click', (e) => {
        if (e.target === confirmOverlay) cerrarConfirm();
    });

    document.querySelectorAll('.admin-nav__item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.admin-nav__item').forEach(i => i.classList.remove('activo'));
            item.classList.add('activo');
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModal();
            cerrarConfirm();
        }
    });
}
