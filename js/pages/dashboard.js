// js/pages/dashboard.js
// ─────────────────────────────────────────────────────────────────────────────
// Motor del Dashboard dinámico — Maye Mundo Belleza
//
// Renderiza el panel correcto según el rol detectado en maye_session:
//   • role === 'admin'  → Panel Admin  (KPIs, productos, pedidos, usuarios)
//   • role === 'client' → Panel Cliente (perfil, pedidos, favoritos)
//
// Todo el acceso a datos pasa por las utilidades centralizadas:
//   authService.js · storage.js · productos.data.js
// ─────────────────────────────────────────────────────────────────────────────

import {
    getSession, logout, AUTH_KEYS, ROLES, STATUS, ADMIN_PRINCIPAL_ID,
    actualizarUsuarioPorAdmin, toggleUserStatus, deleteUserById,
    getUsersCache, refreshUsersCache, updateOwnProfile,
} from '../utils/authService.js';
import Storage from '../utils/storage.js';
import { STORAGE_KEYS, RUTAS, waLink } from '../utils/constants.js';
import {
    obtenerProductos, guardarProductos,
    generarId, formatearPrecio, CATEGORIAS, ETIQUETAS,
    ensureProductosLoaded,
} from '../data/productos.data.js';
import { descargarFacturaPDF, imprimirFactura } from '../utils/invoiceService.js';
import { agregarItem }                          from '../utils/carrito.js';
import { eliminarFavorito, obtenerFavoritos }   from '../utils/wishlistService.js';
import { abrirQuickView, iniciarQuickView }     from '../components/quickView.js';
import {
    obtenerCupones, crearCupon, actualizarCupon,
    toggleCupon, eliminarCupon, refreshCuponesCache,
} from '../utils/couponService.js';
import {
    obtenerTodasLasOrdenes,
    obtenerOrdenesPorUsuario,
    actualizarEstadoOrden,
} from '../utils/orderService.js';

// ── Storage keys adicionales ───────────────────────────────────────────────
const KEYS = {
    FAVORITES: 'maye_favorites',
};

// ── Estado del módulo ──────────────────────────────────────────────────────
let session        = null;
let productos      = [];
/** @type {object[]} */
let _ordersCache   = [];
let toastTimer     = null;
let productoTarget = null; // id a eliminar
let viewActual     = '';

// ── Helpers de datos ───────────────────────────────────────────────────────
function getOrders()    { return _ordersCache; }
function getFavorites() { return Storage.obtener(KEYS.FAVORITES, []); }
function getUsers()     { return getUsersCache(); }

function iniciales(name = '') {
    return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}
function fmtFecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, tipo = 'exito') {
    const el = document.getElementById('db-toast');
    if (!el) return;
    el.querySelector('#db-toast-texto').textContent = msg;
    const ico = el.querySelector('#db-toast-icono');
    ico.className = tipo === 'error'
        ? 'ri-error-warning-fill'
        : tipo === 'info'
        ? 'ri-information-fill'
        : 'ri-checkbox-circle-fill';
    el.className = `db-toast db-toast--visible${tipo === 'error' ? ' db-toast--error' : tipo === 'info' ? ' db-toast--info' : ''}`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('db-toast--visible'), 3500);
}

// ── Navegación de vistas ──────────────────────────────────────────────────
function activarVista(viewId) {
    document.querySelectorAll('.db-view').forEach(v => v.classList.remove('db-view--activa'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.add('db-view--activa');

    document.querySelectorAll('.db-nav__item').forEach(b => {
        b.classList.toggle('db-nav__item--activo', b.dataset.view === viewId);
    });

    const titulos = {
        // cliente
        'resumen':    'Resumen',
        'perfil':     'Mi Perfil',
        'pedidos':    'Mis Pedidos',
        'favoritos':  'Lista de Deseos',
        // admin
        'admin-resumen':    'Resumen General',
        'admin-productos':  'Gestión de Productos',
        'admin-pedidos':    'Gestión de Pedidos',
        'admin-usuarios':   'Gestión de Usuarios',
        'admin-inventario': 'Control de Inventario',
        'admin-analitica':  'Analítica de Ventas',
        'admin-cupones':    'Cupones y Promociones',
    };
    const tb = document.getElementById('db-topbar-titulo');
    if (tb) tb.textContent = titulos[viewId] ?? 'Dashboard';
    viewActual = viewId;
}

// ── Sidebar toggle + backdrop (responsive) ────────────────────────────────
let _backdrop = null;

function _crearBackdrop() {
    if (_backdrop) return _backdrop;
    _backdrop = document.createElement('div');
    _backdrop.className = 'db-sidebar-backdrop';
    _backdrop.id        = 'db-sidebar-backdrop';
    _backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(_backdrop);
    // Cerrar sidebar al tocar el backdrop
    _backdrop.addEventListener('click', () => cerrarSidebarMovil());
    return _backdrop;
}

function abrirSidebarMovil() {
    const sidebar = document.getElementById('db-sidebar');
    if (!sidebar) return;
    sidebar.classList.add('db-sidebar--abierto');
    document.getElementById('db-menu-btn')?.setAttribute('aria-expanded', 'true');
    const bd = _crearBackdrop();
    // Pequeño delay para que la transición CSS sea visible
    requestAnimationFrame(() => bd.classList.add('db-sidebar-backdrop--visible'));
}

function cerrarSidebarMovil() {
    const sidebar = document.getElementById('db-sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('db-sidebar--abierto');
    document.getElementById('db-menu-btn')?.setAttribute('aria-expanded', 'false');
    _backdrop?.classList.remove('db-sidebar-backdrop--visible');
}

function toggleSidebar() {
    const sidebar = document.getElementById('db-sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('db-sidebar--abierto')) {
        cerrarSidebarMovil();
    } else {
        abrirSidebarMovil();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN SIDEBAR: render del bloque de usuario según sesión
// ─────────────────────────────────────────────────────────────────────────────
function renderSidebarUser() {
    const slot = document.getElementById('db-sidebar-user');
    if (!slot) return;
    const ini   = iniciales(session.name);
    const label = session.role === ROLES.ADMIN ? 'Administrador' : 'Cliente';
    const cls   = session.role === ROLES.ADMIN ? 'db-sidebar__user-role--admin' : 'db-sidebar__user-role--client';
    slot.innerHTML = `
        <div class="db-sidebar__avatar">${ini}</div>
        <div class="db-sidebar__user-info">
            <span class="db-sidebar__user-name">${session.name}</span>
            <span class="db-sidebar__user-role ${cls}">${label}</span>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL CLIENTE
// ─────────────────────────────────────────────────────────────────────────────

// ── Vista: Resumen del cliente ─────────────────────────────────────────────
function renderClienteResumen() {
    const orders = getOrders().filter(o => o.userId === session.id);
    const favs   = obtenerFavoritos();
    const kpis = [
        { icon: 'ri-shopping-bag-3-line', cls: 'db-kpi__icon--verde',  num: orders.length,      label: 'Pedidos realizados' },
        { icon: 'ri-heart-3-line',         cls: 'db-kpi__icon--lila',   num: favs.length,        label: 'En lista de deseos' },
        { icon: 'ri-truck-line',           cls: 'db-kpi__icon--azul',   num: orders.filter(o => o.estado === 'enviado').length,    label: 'En camino' },
        { icon: 'ri-checkbox-circle-line', cls: 'db-kpi__icon--naranja',num: orders.filter(o => o.estado === 'completado').length, label: 'Completados' },
    ];
    document.getElementById('db-client-kpis').innerHTML =
        kpis.map(k => `
        <div class="db-kpi">
            <div class="db-kpi__icon ${k.cls}"><i class="${k.icon}"></i></div>
            <div class="db-kpi__body">
                <span class="db-kpi__num">${k.num}</span>
                <span class="db-kpi__label">${k.label}</span>
            </div>
        </div>`).join('');

    // Últimos 3 pedidos
    const recientes = [...orders].sort((a,b) => new Date(b.createdAt ?? b.fecha) - new Date(a.createdAt ?? a.fecha)).slice(0, 3);
    const listEl = document.getElementById('db-client-pedidos-recientes');
    if (!listEl) return;
    if (recientes.length === 0) {
        listEl.innerHTML = `<div class="db-empty"><i class="ri-inbox-line"></i><p>Aún no tienes pedidos</p></div>`;
        return;
    }
    listEl.innerHTML = recientes.map(o => pedidoCardHTML(o)).join('');
    _vincularBotonesFactura(listEl, recientes);
}

// ── Vista: Perfil del cliente ──────────────────────────────────────────────
function renderClientePerfil() {
    const users = getUsers();
    const user  = users.find(u => u.id === session.id) ?? {};
    const extra = Storage.obtener('maye_profile_extra', {});
    document.getElementById('pf-nombre').value    = user.name    ?? session.name;
    document.getElementById('pf-email').value     = user.email   ?? session.email;
    document.getElementById('pf-telefono').value  = user.phone   ?? session.phone ?? '';
    document.getElementById('pf-direccion').value = extra.address ?? user.address ?? '';
    document.getElementById('pf-ciudad').value    = extra.city    ?? user.city    ?? '';
}

async function guardarPerfil(e) {
    e.preventDefault();
    const name    = document.getElementById('pf-nombre').value.trim();
    const phone   = document.getElementById('pf-telefono').value.trim();
    const address = document.getElementById('pf-direccion').value.trim();
    const city    = document.getElementById('pf-ciudad').value.trim();

    const res = await updateOwnProfile({ name, phone, address, city });
    if (!res.ok) {
        toast('No se pudo guardar el perfil', 'error');
        return;
    }

    session = getSession();
    renderSidebarUser();
    toast('Perfil actualizado correctamente');
}

// ── Vista: Pedidos del cliente ─────────────────────────────────────────────
function renderClientePedidos() {
    const orders = getOrders()
        .filter(o => o.userId === session.id)
        .sort((a,b) => new Date(b.createdAt ?? b.fecha) - new Date(a.createdAt ?? a.fecha));

    const el = document.getElementById('db-client-orders-list');
    if (!el) return;
    el.innerHTML = orders.length === 0
        ? `<div class="db-empty"><i class="ri-inbox-line"></i><p>Aún no tienes pedidos. <a href="${RUTAS.PRODUCTOS}" style="color:var(--verde-principal)">¡Explora la tienda!</a></p></div>`
        : orders.map(o => pedidoCardHTML(o)).join('');

    _vincularBotonesFactura(el, orders);
}

function pedidoCardHTML(o) {
    const estadoCls   = { pending:'db-badge--amarillo', pendiente:'db-badge--amarillo', enviado:'db-badge--azul', completado:'db-badge--verde', cancelado:'db-badge--rojo' };
    const estadoLabel = { pending:'Pendiente', pendiente:'Pendiente', enviado:'Enviado', completado:'Completado', cancelado:'Cancelado' };

    // Normalizar campos: las órdenes del orderService usan 'items[].title',
    // las antiguas usaban 'items[].nombre'. Soportar ambas.
    const items = (o.items ?? []).map(it => {
        const nombre  = it.title  ?? it.nombre  ?? '—';
        const qty     = it.quantity ?? it.cantidad ?? 0;
        const precio  = it.price  ?? it.precio  ?? 0;
        const img     = it.imagen ?? '';
        return `
        <div class="db-pedido-item">
            <img src="${img || 'https://placehold.co/40x40/FAF7F2/2A8C64?text=?'}"
                 alt="${nombre}"
                 onerror="this.src='https://placehold.co/40x40/FAF7F2/2A8C64?text=?'">
            <span class="db-pedido-item__nombre">${nombre}</span>
            <span class="db-pedido-item__qty">× ${qty}</span>
            <span class="db-pedido-item__precio">${formatearPrecio(precio * qty)}</span>
        </div>`;
    }).join('');

    // Normalizar total: puede venir en pricing.total o en o.total
    const total  = o.pricing?.total ?? o.total ?? 0;
    const estado = o.status ?? o.estado ?? 'pending';
    const fecha  = o.createdAt ?? o.fecha;

    return `
    <div class="db-pedido-card" data-order-id="${o.id}">
        <div class="db-pedido-card__head">
            <span class="db-pedido-card__id">
                <i class="ri-file-list-3-line"></i> ${o.id}
            </span>
            <span class="db-pedido-card__fecha">${fmtFecha(fecha)}</span>
            <span class="db-badge ${estadoCls[estado] ?? 'db-badge--gris'}">
                ${estadoLabel[estado] ?? estado}
            </span>
            <span class="db-pedido-card__total">${formatearPrecio(total)}</span>
            <!-- Acciones de factura -->
            <div style="display:flex;gap:5px;margin-left:auto;flex-shrink:0">
                <button class="db-btn db-btn--sm"
                        data-factura-pdf="${o.id}"
                        title="Descargar factura PDF"
                        aria-label="Descargar factura PDF del pedido ${o.id}"
                        style="gap:5px">
                    <i class="ri-file-download-line"></i>
                    <span class="hide-xs">PDF</span>
                </button>
                <button class="db-btn db-btn--sm"
                        data-factura-print="${o.id}"
                        title="Imprimir comprobante"
                        aria-label="Imprimir comprobante del pedido ${o.id}">
                    <i class="ri-printer-line"></i>
                </button>
            </div>
        </div>
        ${items ? `<div class="db-pedido-card__body">${items}</div>` : ''}
    </div>`;
}

// ── Vista: Favoritos del cliente ───────────────────────────────────────────
function renderClienteFavoritos() {
    const favIds = obtenerFavoritos();
    const prods  = obtenerProductos().filter(p => favIds.includes(p.id));
    const el     = document.getElementById('db-client-favs-grid');
    if (!el) return;

    if (prods.length === 0) {
        el.innerHTML = `
            <div class="db-empty" style="grid-column:1/-1">
                <i class="ri-heart-3-line"></i>
                <p>Tu lista de deseos está vacía.<br>
                   <a href="${RUTAS.PRODUCTOS}" style="color:var(--verde-principal);font-weight:600">
                       Descubre productos
                   </a>
                </p>
            </div>`;
        return;
    }

    el.innerHTML = prods.map(p => {
        const agotado  = p.stock === 0 || p.etiqueta === 'agotado';
        const etiqData = p.etiqueta && ETIQUETAS[p.etiqueta];
        const badgeHTML = etiqData
            ? `<span class="db-fav-card__badge etiqueta-producto ${etiqData.clase}">${etiqData.texto}</span>`
            : '';
        const catLabel  = CATEGORIAS.find(c => c.id === p.categoria)?.label ?? p.categoria;
        const precioAnt = p.precioAnterior
            ? `<span class="db-fav-card__precio-ant">${formatearPrecio(p.precioAnterior)}</span>`
            : '';

        return `
        <div class="db-fav-card" data-fav-card-id="${p.id}">
            <div class="db-fav-card__img-wrap">
                <img src="${p.imagen}"
                     alt="${p.nombre}"
                     loading="lazy"
                     onerror="this.src='https://placehold.co/240x240/FAF7F2/2A8C64?text=Maye'">
                ${badgeHTML}
            </div>
            <div class="db-fav-card__body">
                <span class="db-fav-card__cat">${catLabel}</span>
                <div class="db-fav-card__nombre">${p.nombre}</div>
                <div class="db-fav-card__precios">
                    <span class="db-fav-card__precio">${formatearPrecio(p.precio)}</span>
                    ${precioAnt}
                </div>
            </div>
            <div class="db-fav-card__footer">
                <button class="db-fav-card__btn-carrito"
                        data-fav-carrito
                        data-id="${p.id}"
                        data-nombre="${p.nombre.replace(/"/g,'&quot;')}"
                        data-precio="${p.precio}"
                        data-imagen="${p.imagen}"
                        ${agotado ? 'disabled' : ''}
                        aria-label="${agotado ? 'Agotado' : `Agregar ${p.nombre} al carrito`}">
                    <i class="${agotado ? 'ri-close-circle-line' : 'ri-shopping-bag-3-line'}"></i>
                    ${agotado ? 'Agotado' : 'Al carrito'}
                </button>
                <button class="db-fav-card__btn-qv"
                        data-fav-qv
                        data-id="${p.id}"
                        title="Vista rápida"
                        aria-label="Vista rápida de ${p.nombre}">
                    <i class="ri-eye-line"></i>
                </button>
                <button class="db-fav-card__btn-rm"
                        data-fav-rm
                        data-id="${p.id}"
                        title="Quitar de favoritos"
                        aria-label="Quitar ${p.nombre} de favoritos">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
                         aria-hidden="true" focusable="false">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>`;
    }).join('');

    // ── Delegación única en el contenedor (sobrevive a re-renders) ─────
    // Removemos el listener anterior para evitar duplicados
    el.replaceWith(el.cloneNode(true));
    const grid = document.getElementById('db-client-favs-grid');

    grid.addEventListener('click', e => {
        // ── Agregar al carrito ──────────────────────────────────────
        const btnCart = e.target.closest('[data-fav-carrito]');
        if (btnCart && !btnCart.disabled) {
            agregarItem({
                id:     Number(btnCart.dataset.id),
                nombre: btnCart.dataset.nombre,
                precio: Number(btnCart.dataset.precio),
                imagen: btnCart.dataset.imagen,
            });
            const orig = btnCart.innerHTML;
            btnCart.innerHTML = '<i class="ri-check-line"></i> ¡Listo!';
            btnCart.disabled  = true;
            setTimeout(() => { btnCart.innerHTML = orig; btnCart.disabled = false; }, 1500);
            return;
        }

        // ── Vista rápida ────────────────────────────────────────────
        const btnQV = e.target.closest('[data-fav-qv]');
        if (btnQV) {
            abrirQuickView(Number(btnQV.dataset.id));
            return;
        }

        // ── Eliminar de favoritos ───────────────────────────────────
        const btnRm = e.target.closest('[data-fav-rm]');
        if (btnRm) {
            const id = Number(btnRm.dataset.id);
            eliminarFavorito(id);
            toast('Producto eliminado de favoritos');
            renderClienteFavoritos();   // re-render (incluye empty state)
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — KPIs
// ─────────────────────────────────────────────────────────────────────────────
function renderAdminResumen() {
    const prods  = obtenerProductos();
    const orders = getOrders();
    const users  = getUsers().filter(u => u.role === ROLES.CLIENT);
    const ventas = orders.reduce((s, o) => s + (o.total ?? 0), 0);

    const kpis = [
        { icon:'ri-shopping-bag-3-line',  cls:'db-kpi__icon--verde',   num: formatearPrecio(ventas), label:'Total ventas',     delta: `${orders.filter(o=>o.estado==='completado').length} completados` },
        { icon:'ri-file-list-3-line',     cls:'db-kpi__icon--azul',    num: orders.length,           label:'Pedidos',          delta: `${orders.filter(o=>o.estado==='pendiente').length} pendientes` },
        { icon:'ri-user-heart-line',      cls:'db-kpi__icon--lila',    num: users.length,            label:'Clientes',         delta: 'usuarios registrados' },
        { icon:'ri-store-2-line',         cls:'db-kpi__icon--naranja', num: prods.length,            label:'Productos',        delta: `${prods.filter(p=>p.visible).length} visibles` },
        { icon:'ri-archive-line',         cls:'db-kpi__icon--rojo',    num: prods.filter(p=>p.stock===0).length,  label:'Agotados',  delta: 'sin stock' },
        { icon:'ri-eye-off-line',         cls:'db-kpi__icon--amarillo',num: prods.filter(p=>!p.visible).length,  label:'Ocultos',   delta: 'en catálogo' },
    ];

    document.getElementById('db-admin-kpis').innerHTML = kpis.map(k => `
    <div class="db-kpi">
        <div class="db-kpi__icon ${k.cls}"><i class="${k.icon}"></i></div>
        <div class="db-kpi__body">
            <span class="db-kpi__num">${k.num}</span>
            <span class="db-kpi__label">${k.label}</span>
            <span class="db-kpi__delta">${k.delta}</span>
        </div>
    </div>`).join('');

    // Últimos 5 pedidos
    const recientes = [...orders].sort((a,b) => new Date(b.fecha)-new Date(a.fecha)).slice(0,5);
    const tBody = document.getElementById('db-admin-recent-orders');
    if (!tBody) return;
    if (recientes.length === 0) {
        tBody.innerHTML = `<tr><td colspan="5"><div class="db-empty"><i class="ri-inbox-line"></i><p>Sin pedidos aún</p></div></td></tr>`;
        return;
    }
    const badge = o => {
        const m = { pendiente:'db-badge--amarillo', enviado:'db-badge--azul', completado:'db-badge--verde', cancelado:'db-badge--rojo' };
        const l = { pendiente:'Pendiente', enviado:'Enviado', completado:'Completado', cancelado:'Cancelado' };
        return `<span class="db-badge ${m[o.estado]??'db-badge--gris'}">${l[o.estado]??o.estado}</span>`;
    };
    tBody.innerHTML = recientes.map(o => {
        const estado = o.status ?? o.estado ?? 'pending';
        const total  = o.pricing?.total ?? o.total ?? 0;
        const fecha  = o.createdAt ?? o.fecha;
        const cliente = o.customerInfo?.name ?? o.clienteName ?? '—';
        const badge = o => {
            const m = { pending:'db-badge--amarillo', pendiente:'db-badge--amarillo', enviado:'db-badge--azul', completado:'db-badge--verde', cancelado:'db-badge--rojo' };
            const l = { pending:'Pendiente', pendiente:'Pendiente', enviado:'Enviado', completado:'Completado', cancelado:'Cancelado' };
            return `<span class="db-badge ${m[estado]??'db-badge--gris'}">${l[estado]??estado}</span>`;
        };
        return `
    <tr>
        <td class="db-table__bold">${o.id}</td>
        <td>${cliente}</td>
        <td>${fmtFecha(fecha)}</td>
        <td class="db-table__price">${formatearPrecio(total)}</td>
        <td>${badge(o)}</td>
    </tr>`;
    }).join('');
    _vincularBotonesFactura(tBody, recientes);
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Productos (CRUD completo, reutiliza lógica de admin.js)
// ─────────────────────────────────────────────────────────────────────────────
let filtroProductos = '';

function renderAdminProductos() {
    productos = obtenerProductos();
    _pintarTablaProductos();
    _actualizarStatsBadges();
}

function _pintarTablaProductos() {
    const filtrados = filtroProductos
        ? productos.filter(p =>
            p.nombre.toLowerCase().includes(filtroProductos) ||
            p.categoria.toLowerCase().includes(filtroProductos))
        : productos;

    const tbody = document.getElementById('db-prod-tbody');
    if (!tbody) return;

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="db-empty"><i class="ri-inbox-line"></i><p>No se encontraron productos</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        const cat   = CATEGORIAS.find(c => c.id === p.categoria)?.label ?? p.categoria;
        const et    = p.etiqueta ? (ETIQUETAS[p.etiqueta]?.texto ?? p.etiqueta) : '—';
        const agot  = p.stock === 0;
        const bcls  = agot ? 'db-badge--rojo' : p.visible ? 'db-badge--verde' : 'db-badge--gris';
        const btxt  = agot ? 'Agotado' : p.visible ? 'Visible' : 'Oculto';
        return `
        <tr>
            <td><img class="db-table__img" src="${p.imagen}" alt="${p.nombre}"
                     onerror="this.src='https://placehold.co/44x44/FAF7F2/2A8C64?text=?'"></td>
            <td><div class="db-table__bold" style="max-width:180px">${p.nombre}</div></td>
            <td class="db-table__muted">${cat}</td>
            <td class="db-table__price">${formatearPrecio(p.precio)}</td>
            <td class="${p.stock===0?'db-table__muted':''}"><b style="color:${p.stock===0?'#dc2626':'inherit'}">${p.stock}</b></td>
            <td class="db-table__muted">${et}</td>
            <td><span class="db-badge ${bcls}">${btxt}</span></td>
            <td>
                <div class="db-table__actions">
                    <button class="db-btn db-btn--sm db-btn--icon" data-prod-edit="${p.id}" title="Editar"><i class="ri-pencil-line"></i></button>
                    <button class="db-btn db-btn--sm db-btn--icon" data-prod-toggle="${p.id}" title="${p.visible?'Ocultar':'Mostrar'}"><i class="ri-eye${p.visible?'-off':''}-line"></i></button>
                    <button class="db-btn db-btn--sm db-btn--icon db-btn--danger" data-prod-del="${p.id}" title="Eliminar"><i class="ri-delete-bin-line"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-prod-edit]').forEach(b => b.addEventListener('click', () => abrirModalProducto(Number(b.dataset.prodEdit))));
    tbody.querySelectorAll('[data-prod-toggle]').forEach(b => b.addEventListener('click', () => toggleProducto(Number(b.dataset.prodToggle))));
    tbody.querySelectorAll('[data-prod-del]').forEach(b => b.addEventListener('click', () => pedirConfirmEliminar(Number(b.dataset.prodDel))));
}

function _actualizarStatsBadges() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('db-prod-total',    productos.length);
    set('db-prod-visibles', productos.filter(p=>p.visible).length);
    set('db-prod-agotados', productos.filter(p=>p.stock===0).length);
    set('db-prod-ocultos',  productos.filter(p=>!p.visible).length);
}

// ── Modal de Producto ──────────────────────────────────────────────────────
function abrirModalProducto(id = null) {
    document.getElementById('db-prod-form')?.reset();
    document.getElementById('db-prod-id').value = '';
    const titulo = document.getElementById('db-prod-modal-titulo');

    if (id !== null) {
        const p = productos.find(x => x.id === id);
        if (!p) return;
        if (titulo) titulo.textContent = 'Editar producto';
        document.getElementById('db-prod-id').value           = p.id;
        document.getElementById('db-p-nombre').value          = p.nombre;
        document.getElementById('db-p-categoria').value       = p.categoria;
        document.getElementById('db-p-precio').value          = p.precio;
        document.getElementById('db-p-precio-ant').value      = p.precioAnterior ?? '';
        document.getElementById('db-p-stock').value           = p.stock;
        document.getElementById('db-p-etiqueta').value        = p.etiqueta ?? '';
        document.getElementById('db-p-imagen').value          = p.imagen;
        document.getElementById('db-p-descripcion').value     = p.descripcion ?? '';
        document.getElementById('db-p-whatsapp').value        = p.whatsapp ?? '';
    } else {
        if (titulo) titulo.textContent = 'Nuevo producto';
    }
    _modalProducto(true);
    setTimeout(() => document.getElementById('db-p-nombre')?.focus(), 200);
}

function _modalProducto(abrir) {
    const el = document.getElementById('db-modal-producto');
    if (!el) return;
    el.classList.toggle('db-modal-overlay--visible', abrir);
}

function guardarProducto() {
    const idGuardado = document.getElementById('db-prod-id').value;
    const nombre     = document.getElementById('db-p-nombre').value.trim();
    const categoria  = document.getElementById('db-p-categoria').value;
    const precio     = Number(document.getElementById('db-p-precio').value);
    const precioAnt  = document.getElementById('db-p-precio-ant').value;
    const stock      = Number(document.getElementById('db-p-stock').value) || 0;
    const etiqueta   = document.getElementById('db-p-etiqueta').value || null;
    const imagen     = document.getElementById('db-p-imagen').value.trim();
    const desc       = document.getElementById('db-p-descripcion').value.trim();
    const wa         = document.getElementById('db-p-whatsapp').value.trim();

    if (!nombre || !categoria || !precio || !imagen) {
        toast('Completa los campos obligatorios (*)', 'error'); return;
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
        toast('Producto actualizado correctamente');
    } else {
        productos.push({
            id:           generarId(productos),
            nombre, categoria, precio,
            precioAnterior: precioAnt ? Number(precioAnt) : null,
            stock, etiqueta, imagen,
            descripcion:  desc,
            whatsapp:     wa || `Hola!%20Me%20interesa%20${encodeURIComponent(nombre)}`,
            visible:      true,
        });
        toast('Producto creado correctamente');
    }
    guardarProductos(productos);
    _pintarTablaProductos();
    _actualizarStatsBadges();
    _modalProducto(false);
}

function toggleProducto(id) {
    const idx = productos.findIndex(p => p.id === id);
    if (idx === -1) return;
    productos[idx].visible = !productos[idx].visible;
    guardarProductos(productos);
    _pintarTablaProductos();
    _actualizarStatsBadges();
    toast(`Producto ${productos[idx].visible ? 'visible' : 'oculto'}`);
}

// ── Confirm eliminar ───────────────────────────────────────────────────────
function pedirConfirmEliminar(id) {
    productoTarget = id;
    const el = document.getElementById('db-confirm');
    if (el) el.classList.add('db-confirm-overlay--visible');
}
function cerrarConfirm() {
    productoTarget = null;
    const el = document.getElementById('db-confirm');
    if (el) el.classList.remove('db-confirm-overlay--visible');
}
function confirmarEliminar() {
    if (productoTarget === null) return;
    productos = productos.filter(p => p.id !== productoTarget);
    guardarProductos(productos);
    _pintarTablaProductos();
    _actualizarStatsBadges();
    cerrarConfirm();
    toast('Producto eliminado');
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Pedidos (gestión de estados)
// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Pedidos (gestión de estados)
// ─────────────────────────────────────────────────────────────────────────────
function renderAdminPedidos() {
    // Soportar tanto órdenes del orderService (status/createdAt/pricing)
    // como órdenes del formato legacy (estado/fecha/total).
    const orders = [...getOrders()].sort((a,b) =>
        new Date(b.createdAt ?? b.fecha) - new Date(a.createdAt ?? a.fecha)
    );
    const tbody  = document.getElementById('db-orders-tbody');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="db-empty"><i class="ri-inbox-line"></i><p>No hay pedidos registrados</p></div></td></tr>`;
        return;
    }

    const estadoOpts = ['pending','pendiente','enviado','completado','cancelado']
        .filter((v,i,a) => a.indexOf(v) === i) // deduplicar
        .map(s => `<option value="${s}">${{pending:'Pendiente',pendiente:'Pendiente',enviado:'Enviado',completado:'Completado',cancelado:'Cancelado'}[s] ?? s}</option>`)
        .join('');

    tbody.innerHTML = orders.map(o => {
        const estado  = o.status ?? o.estado ?? 'pending';
        const fecha   = o.createdAt ?? o.fecha;
        const total   = o.pricing?.total ?? o.total ?? 0;
        const cliente = o.customerInfo?.name ?? o.clienteName ?? '—';
        const email   = o.customerInfo
            ? `${o.customerInfo.phone ?? ''}` : (o.clienteEmail ?? '');
        const nItems  = (o.items ?? []).length;
        const badge   = { pending:'db-badge--amarillo', pendiente:'db-badge--amarillo',
                          enviado:'db-badge--azul', completado:'db-badge--verde',
                          cancelado:'db-badge--rojo' };

        return `
        <tr>
            <td class="db-table__bold">${o.id}</td>
            <td>${cliente}<br><span class="db-table__muted">${email}</span></td>
            <td>${fmtFecha(fecha)}</td>
            <td class="db-table__price">${formatearPrecio(total)}</td>
            <td>${nItems} ítem(s)</td>
            <td><span class="db-badge ${badge[estado]??'db-badge--gris'}">${estado}</span></td>
            <td>
                <select class="db-status-select" data-order-id="${o.id}">
                    ${estadoOpts.replace(`value="${estado}"`,`value="${estado}" selected`)}
                </select>
            </td>
            <td>
                <div class="db-table__actions">
                    <button class="db-btn db-btn--sm db-btn--icon"
                            data-factura-pdf="${o.id}"
                            title="Descargar PDF"
                            aria-label="Descargar factura PDF del pedido ${o.id}">
                        <i class="ri-file-download-line"></i>
                    </button>
                    <button class="db-btn db-btn--sm db-btn--icon"
                            data-factura-print="${o.id}"
                            title="Imprimir"
                            aria-label="Imprimir comprobante del pedido ${o.id}">
                        <i class="ri-printer-line"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // ── Estado: change listener ───────────────────────────────────────────
    tbody.querySelectorAll('[data-order-id]').forEach(sel => {
        sel.addEventListener('change', async () => {
            const res = await actualizarEstadoOrden(sel.dataset.orderId, sel.value);
            if (!res.ok) {
                toast('No se pudo actualizar el pedido', 'error');
                return;
            }
            const idx = _ordersCache.findIndex(o => String(o.id) === String(sel.dataset.orderId));
            if (idx !== -1) _ordersCache[idx] = res.order;
            toast(`Pedido ${sel.dataset.orderId} → ${sel.value}`, 'info');
            const row     = sel.closest('tr');
            const badgeCls = { pending:'db-badge--amarillo', pendiente:'db-badge--amarillo',
                                enviado:'db-badge--azul', completado:'db-badge--verde',
                                cancelado:'db-badge--rojo' };
            const badgeEl = row?.querySelector('.db-badge');
            if (badgeEl) {
                badgeEl.className   = `db-badge ${badgeCls[sel.value]??'db-badge--gris'}`;
                badgeEl.textContent = sel.value;
            }
        });
    });

    // ── Botones de factura ────────────────────────────────────────────────
    _vincularBotonesFactura(tbody, orders);
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Usuarios
// ─────────────────────────────────────────────────────────────────────────────
function renderAdminUsuarios() {
    const allUsers = getUsers();
    const orders   = getOrders();
    const tbody    = document.getElementById('db-users-tbody');
    if (!tbody) return;

    if (allUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="db-empty">
            <i class="ri-user-3-line"></i><p>No hay usuarios registrados</p>
        </div></td></tr>`;
        return;
    }

    tbody.innerHTML = allUsers.map(u => {
        const userOrders     = orders.filter(o => o.userId === u.id);
        const totalCompras   = userOrders.reduce((s, o) => s + (o.total ?? 0), 0);
        const ini            = iniciales(u.name);
        const esSesionActiva = u.id === session.id;
        const esProtegido    = u.id === ADMIN_PRINCIPAL_ID;

        // ── Status badge (retrocompatible: sin status → active) ────────────
        const statusActual = u.status ?? STATUS.ACTIVE;
        const esActivo     = statusActual === STATUS.ACTIVE;
        const statusBadge  = esActivo
            ? `<span class="db-badge db-badge--verde"><i class="ri-checkbox-circle-line"></i> Activo</span>`
            : `<span class="db-badge db-badge--rojo"><i class="ri-forbid-line"></i> Inactivo</span>`;

        // ── Rol badge ──────────────────────────────────────────────────────
        const rolBadge = u.role === ROLES.ADMIN
            ? `<span class="db-badge db-badge--lila"><i class="ri-shield-star-line"></i> Admin</span>`
            : `<span class="db-badge db-badge--gris">Cliente</span>`;

        // ── Botones de acción con protecciones visuales ────────────────────
        // Toggle estado: desactivado para el propio admin o cuenta protegida
        const puedeToggle  = !esSesionActiva && !esProtegido;
        const toggleTitle  = esSesionActiva  ? 'No puedes inactivar tu propia sesión'
                           : esProtegido     ? 'Cuenta de administrador principal protegida'
                           : esActivo        ? 'Inactivar usuario'
                           : 'Activar usuario';
        const toggleIcon   = esActivo ? 'ri-toggle-fill' : 'ri-toggle-line';
        const toggleColor  = esActivo ? 'color:#f97316' : 'color:var(--verde-principal)';

        // Eliminar: desactivado para sesión activa y cuenta protegida
        const puedeEliminar = !esSesionActiva && !esProtegido;
        const elimTitle     = esSesionActiva ? 'No puedes eliminar tu propia cuenta'
                            : esProtegido    ? 'La cuenta principal no puede eliminarse'
                            : 'Eliminar usuario';

        return `
        <tr style="${!esActivo ? 'opacity:0.65' : ''}">
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <div class="db-sidebar__avatar"
                         style="width:34px;height:34px;font-size:0.75rem;flex-shrink:0;
                                ${u.role === ROLES.ADMIN ? 'background:linear-gradient(135deg,var(--lila-oscuro),var(--lila-acento))' : ''}
                                ${!esActivo ? 'filter:grayscale(0.8)' : ''}">
                        ${ini}
                    </div>
                    <div>
                        <div class="db-table__bold">
                            ${u.name}
                            ${esSesionActiva ? `<span style="font-size:0.65rem;background:rgba(42,140,100,0.1);color:var(--verde-principal);padding:1px 6px;border-radius:10px;margin-left:4px;font-family:var(--fuente-titulos);font-weight:700">Tú</span>` : ''}
                            ${esProtegido    ? `<span style="font-size:0.65rem;background:rgba(184,160,228,0.15);color:var(--lila-oscuro);padding:1px 6px;border-radius:10px;margin-left:4px;font-family:var(--fuente-titulos);font-weight:700"><i class="ri-shield-line"></i></span>` : ''}
                        </div>
                        <div class="db-table__muted">${u.email}</div>
                    </div>
                </div>
            </td>
            <td class="db-table__muted">${u.phone || '—'}</td>
            <td>${fmtFecha(u.createdAt)}</td>
            <td>${userOrders.length}</td>
            <td class="db-table__price">${formatearPrecio(totalCompras)}</td>
            <td>${rolBadge}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="db-table__actions">
                    <!-- Editar -->
                    <button class="db-btn db-btn--sm db-btn--icon"
                            data-usr-edit="${u.id}"
                            title="Editar datos"
                            aria-label="Editar ${u.name}">
                        <i class="ri-pencil-line"></i>
                    </button>
                    <!-- Toggle estado -->
                    <button class="db-btn db-btn--sm db-btn--icon"
                            data-usr-toggle="${u.id}"
                            title="${toggleTitle}"
                            aria-label="${toggleTitle}"
                            ${puedeToggle ? '' : 'disabled style="opacity:0.35;cursor:not-allowed"'}>
                        <i class="${toggleIcon}" style="${toggleColor}"></i>
                    </button>
                    <!-- Eliminar -->
                    <button class="db-btn db-btn--sm db-btn--icon db-btn--danger"
                            data-usr-del="${u.id}"
                            title="${elimTitle}"
                            aria-label="${elimTitle}"
                            ${puedeEliminar ? '' : 'disabled style="opacity:0.35;cursor:not-allowed"'}>
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Vincular eventos de la tabla
    tbody.querySelectorAll('[data-usr-edit]').forEach(btn => {
        btn.addEventListener('click', () => abrirModalEditarUsuario(btn.dataset.usrEdit));
    });
    tbody.querySelectorAll('[data-usr-toggle]:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => pedirConfirmToggleUsuario(btn.dataset.usrToggle));
    });
    tbody.querySelectorAll('[data-usr-del]:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => pedirConfirmEliminarUsuario(btn.dataset.usrDel));
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTURA — vincular botones PDF/Imprimir en cualquier contenedor
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Vincula los botones [data-factura-pdf] y [data-factura-print]
 * dentro del contenedor dado, usando el array de órdenes para buscar por ID.
 *
 * @param {Element}  container  El nodo padre que contiene los botones.
 * @param {object[]} orders     Lista de órdenes donde buscar el ID.
 */
function _vincularBotonesFactura(container, orders) {
    // PDF
    container.querySelectorAll('[data-factura-pdf]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const order = orders.find(o => String(o.id) === String(btn.dataset.facturaPdf));
            if (!order) { toast('Orden no encontrada', 'error'); return; }

            const textoOriginal = btn.innerHTML;
            btn.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 0.8s linear infinite"></i>';
            btn.disabled  = true;
            try {
                await descargarFacturaPDF(order);
                toast('Factura descargada correctamente');
            } catch (err) {
                console.error('[Dashboard] Error PDF:', err);
                toast('No se pudo generar el PDF', 'error');
            } finally {
                btn.innerHTML = textoOriginal;
                btn.disabled  = false;
            }
        });
    });

    // Imprimir
    container.querySelectorAll('[data-factura-print]').forEach(btn => {
        btn.addEventListener('click', () => {
            const order = orders.find(o => String(o.id) === String(btn.dataset.facturaPrint));
            if (!order) { toast('Orden no encontrada', 'error'); return; }
            imprimirFactura(order);
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Inventario y alertas de bajo stock
// ─────────────────────────────────────────────────────────────────────────────
let umbralStock = 5;  // configurable desde la UI

function renderAdminInventario() {
    const todos     = obtenerProductos();
    const busqueda  = document.getElementById('db-inv-buscar')?.value.toLowerCase() ?? '';
    const filtrados = busqueda
        ? todos.filter(p => p.nombre.toLowerCase().includes(busqueda) ||
                            p.categoria.toLowerCase().includes(busqueda))
        : todos;

    // ── Mini-KPIs ─────────────────────────────────────────────────────────
    const kpiEl = document.getElementById('db-inv-kpis');
    if (kpiEl) {
        const agotados  = todos.filter(p => p.stock === 0).length;
        const bajoStock = todos.filter(p => p.stock > 0 && p.stock <= umbralStock).length;
        const ok        = todos.filter(p => p.stock > umbralStock).length;
        const total     = todos.reduce((s, p) => s + p.stock, 0);
        kpiEl.innerHTML = [
            { icon:'ri-box-3-line',       cls:'db-kpi__icon--verde',   num: total,     label:'Unidades totales' },
            { icon:'ri-checkbox-circle-line', cls:'db-kpi__icon--azul', num: ok,        label:'Stock OK' },
            { icon:'ri-alarm-warning-line', cls:'db-kpi__icon--amarillo', num: bajoStock, label:`Bajo stock (≤${umbralStock})` },
            { icon:'ri-archive-line',       cls:'db-kpi__icon--rojo',   num: agotados,  label:'Agotados' },
        ].map(k => `
        <div class="db-kpi">
            <div class="db-kpi__icon ${k.cls}"><i class="${k.icon}"></i></div>
            <div class="db-kpi__body">
                <span class="db-kpi__num">${k.num}</span>
                <span class="db-kpi__label">${k.label}</span>
            </div>
        </div>`).join('');
    }

    // ── Tabla ─────────────────────────────────────────────────────────────
    const tbody = document.getElementById('db-inv-tbody');
    if (!tbody) return;

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="db-empty"><i class="ri-inbox-line"></i><p>Sin resultados</p></div></td></tr>`;
        return;
    }

    // Ordenar: agotados primero, luego bajo stock, luego OK
    const ordenados = [...filtrados].sort((a, b) => a.stock - b.stock);

    tbody.innerHTML = ordenados.map(p => {
        const cat     = CATEGORIAS.find(c => c.id === p.categoria)?.label ?? p.categoria;
        const agotado = p.stock === 0;
        const bajo    = p.stock > 0 && p.stock <= umbralStock;

        // Barra de stock visual
        const maxBar = 50;
        const pct    = Math.min(100, (p.stock / maxBar) * 100);
        const barClr = agotado ? '#ef4444' : bajo ? '#f59e0b' : 'var(--verde-principal)';
        const estadoBadge = agotado
            ? `<span class="db-badge db-badge--rojo"><i class="ri-close-circle-line"></i> Agotado</span>`
            : bajo
            ? `<span class="db-badge db-badge--amarillo"><i class="ri-alarm-warning-line"></i> Bajo stock</span>`
            : `<span class="db-badge db-badge--verde"><i class="ri-checkbox-circle-line"></i> OK</span>`;

        return `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <img class="db-table__img" src="${p.imagen}" alt="${p.nombre}"
                         onerror="this.src='https://placehold.co/44x44/FAF7F2/2A8C64?text=?'">
                    <span class="db-table__bold">${p.nombre}</span>
                </div>
            </td>
            <td class="db-table__muted">${cat}</td>
            <td>
                <div class="db-inv-stock-wrap">
                    <span class="db-inv-stock-num" style="color:${barClr};font-weight:700">
                        ${p.stock}
                    </span>
                    <div class="db-inv-bar-bg">
                        <div class="db-inv-bar-fill"
                             style="width:${pct}%;background:${barClr}"></div>
                    </div>
                </div>
            </td>
            <td>${estadoBadge}</td>
            <td>
                <div class="db-table__actions">
                    <button class="db-btn db-btn--sm db-btn--icon"
                            data-inv-dec="${p.id}"
                            title="Reducir 1 unidad"
                            aria-label="Reducir stock de ${p.nombre}">
                        <i class="ri-subtract-line"></i>
                    </button>
                    <span class="db-inv-qty" id="db-inv-qty-${p.id}"
                          style="min-width:28px;text-align:center;
                                 font-family:var(--fuente-titulos);font-weight:700">
                        ${p.stock}
                    </span>
                    <button class="db-btn db-btn--sm db-btn--icon"
                            data-inv-inc="${p.id}"
                            title="Aumentar 1 unidad"
                            aria-label="Aumentar stock de ${p.nombre}">
                        <i class="ri-add-line"></i>
                    </button>
                    <button class="db-btn db-btn--sm"
                            data-inv-set="${p.id}"
                            data-inv-nombre="${p.nombre.replace(/"/g,'&quot;')}"
                            title="Establecer valor exacto"
                            style="gap:4px">
                        <i class="ri-pencil-line"></i> Editar
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // ── Eventos de la tabla ────────────────────────────────────────────────
    tbody.querySelectorAll('[data-inv-dec]').forEach(btn => {
        btn.addEventListener('click', () => _ajustarStock(Number(btn.dataset.invDec), -1));
    });
    tbody.querySelectorAll('[data-inv-inc]').forEach(btn => {
        btn.addEventListener('click', () => _ajustarStock(Number(btn.dataset.invInc), +1));
    });
    tbody.querySelectorAll('[data-inv-set]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id     = Number(btn.dataset.invSet);
            const nombre = btn.dataset.invNombre;
            const actual = obtenerProductos().find(p => p.id === id)?.stock ?? 0;
            const nuevo  = parseInt(prompt(`Stock actual de "${nombre}": ${actual}\nIngresa el nuevo valor:`, actual), 10);
            if (!isNaN(nuevo) && nuevo >= 0) {
                const prods = obtenerProductos();
                const idx   = prods.findIndex(p => p.id === id);
                if (idx !== -1) {
                    prods[idx].stock    = nuevo;
                    prods[idx].etiqueta = nuevo === 0 ? 'agotado'
                                        : prods[idx].etiqueta === 'agotado' ? null
                                        : prods[idx].etiqueta;
                    guardarProductos(prods);
                    renderAdminInventario();
                    toast(`Stock de "${nombre}" actualizado a ${nuevo} unidades`);
                }
            }
        });
    });
}

function _ajustarStock(productId, delta) {
    const prods = obtenerProductos();
    const idx   = prods.findIndex(p => p.id === productId);
    if (idx === -1) return;
    const nuevo = Math.max(0, prods[idx].stock + delta);
    prods[idx].stock    = nuevo;
    prods[idx].etiqueta = nuevo === 0 ? 'agotado'
                        : prods[idx].etiqueta === 'agotado' ? null
                        : prods[idx].etiqueta;
    guardarProductos(prods);
    renderAdminInventario();
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Analítica de Ventas (gráficos CSS puros, sin dependencias)
// ─────────────────────────────────────────────────────────────────────────────
function renderAdminAnalitica() {
    const orders  = getOrders();
    const prods   = obtenerProductos();
    const users   = getUsers().filter(u => u.role === ROLES.CLIENT);

    // ── KPIs principales ──────────────────────────────────────────────────
    const kpiEl = document.getElementById('db-anal-kpis');
    if (kpiEl) {
        const totalVentas  = orders.reduce((s, o) => s + (o.pricing?.total ?? o.total ?? 0), 0);
        const completados  = orders.filter(o => (o.status ?? o.estado) === 'completado');
        const pendientes   = orders.filter(o => ['pending','pendiente'].includes(o.status ?? o.estado));
        const ticketProm   = completados.length
            ? Math.round(completados.reduce((s,o) => s+(o.pricing?.total??o.total??0), 0) / completados.length)
            : 0;

        kpiEl.innerHTML = [
            { icon:'ri-money-dollar-circle-line', cls:'db-kpi__icon--verde',   num: formatearPrecio(totalVentas), label:'Total facturado', delta:`${completados.length} completados` },
            { icon:'ri-file-list-3-line',         cls:'db-kpi__icon--azul',    num: orders.length,               label:'Pedidos totales', delta:`${pendientes.length} pendientes` },
            { icon:'ri-user-heart-line',          cls:'db-kpi__icon--lila',    num: users.length,                label:'Clientes',        delta:'usuarios registrados' },
            { icon:'ri-shopping-cart-2-line',     cls:'db-kpi__icon--naranja', num: formatearPrecio(ticketProm), label:'Ticket promedio', delta:'por pedido completado' },
        ].map(k => `
        <div class="db-kpi">
            <div class="db-kpi__icon ${k.cls}"><i class="${k.icon}"></i></div>
            <div class="db-kpi__body">
                <span class="db-kpi__num">${k.num}</span>
                <span class="db-kpi__label">${k.label}</span>
                <span class="db-kpi__delta">${k.delta}</span>
            </div>
        </div>`).join('');
    }

    // ── Gráfico: ventas por estado ─────────────────────────────────────────
    const chartEstados = document.getElementById('db-anal-estados-chart');
    if (chartEstados) {
        const estados = {
            pending:    { label:'Pendiente', color:'#f59e0b' },
            pendiente:  { label:'Pendiente', color:'#f59e0b' },
            enviado:    { label:'Enviado',   color:'#3b82f6' },
            completado: { label:'Completado',color:'var(--verde-principal)' },
            cancelado:  { label:'Cancelado', color:'#ef4444' },
        };
        const conteo = {};
        orders.forEach(o => {
            const e = o.status ?? o.estado ?? 'pending';
            const key = e === 'pendiente' ? 'pending' : e;
            conteo[key] = (conteo[key] ?? 0) + 1;
        });

        const max = Math.max(...Object.values(conteo), 1);
        const keys = ['pending','enviado','completado','cancelado'];
        chartEstados.innerHTML = keys.map(k => {
            const est = estados[k];
            const cnt = conteo[k] ?? 0;
            const pct = Math.round((cnt / max) * 100);
            return `
            <div class="db-chart-row">
                <span class="db-chart-label">${est.label}</span>
                <div class="db-chart-bar-bg">
                    <div class="db-chart-bar-fill"
                         style="width:${pct}%;background:${est.color}">
                    </div>
                </div>
                <span class="db-chart-val">${cnt}</span>
            </div>`;
        }).join('');
    }

    // ── Gráfico: top productos más pedidos ─────────────────────────────────
    const chartTop = document.getElementById('db-anal-top-productos');
    if (chartTop) {
        const conteoProds = {};
        orders.forEach(o => {
            (o.items ?? []).forEach(item => {
                const key = item.title ?? item.nombre ?? item.productId;
                conteoProds[key] = (conteoProds[key] ?? 0) + (item.quantity ?? item.cantidad ?? 1);
            });
        });
        const topProds = Object.entries(conteoProds)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        if (topProds.length === 0) {
            chartTop.innerHTML = `<div class="db-empty"><i class="ri-bar-chart-2-line"></i><p>Sin datos aún</p></div>`;
        } else {
            const maxP = Math.max(...topProds.map(x => x[1]), 1);
            chartTop.innerHTML = topProds.map(([nombre, qty], i) => {
                const pct = Math.round((qty / maxP) * 100);
                const colores = ['var(--verde-principal)','var(--lila-oscuro)','#3b82f6','#f97316','#ec4899','#ca8a04'];
                return `
                <div class="db-chart-row">
                    <span class="db-chart-label db-chart-label--sm">${nombre.length > 24 ? nombre.slice(0,22)+'…' : nombre}</span>
                    <div class="db-chart-bar-bg">
                        <div class="db-chart-bar-fill"
                             style="width:${pct}%;background:${colores[i % colores.length]}">
                        </div>
                    </div>
                    <span class="db-chart-val">${qty}</span>
                </div>`;
            }).join('');
        }
    }

    // ── Gráfico: métodos de pago ───────────────────────────────────────────
    const chartMetodos = document.getElementById('db-anal-metodos-pago');
    if (chartMetodos) {
        const METODO_LABELS = {
            nequi:         'Nequi',
            bancolombia:   'Bancolombia',
            contraentrega: 'Contraentrega',
        };
        const conteoMet = {};
        orders.forEach(o => {
            const m = o.paymentMethod ?? 'desconocido';
            conteoMet[m] = (conteoMet[m] ?? 0) + 1;
        });
        const total  = orders.length || 1;
        const colMet = { nequi:'#a855f7', bancolombia:'#f59e0b', contraentrega:'var(--verde-principal)' };

        if (Object.keys(conteoMet).length === 0) {
            chartMetodos.innerHTML = `<div class="db-empty"><i class="ri-bank-card-line"></i><p>Sin datos aún</p></div>`;
        } else {
            chartMetodos.innerHTML = `
            <div class="db-chart-metodos">
                ${Object.entries(conteoMet).map(([m, cnt]) => {
                    const pct  = Math.round((cnt / total) * 100);
                    const lbl  = METODO_LABELS[m] ?? m;
                    const clr  = colMet[m] ?? '#6b7280';
                    return `
                    <div class="db-chart-metodo-item">
                        <div class="db-chart-metodo-header">
                            <span class="db-chart-metodo-dot" style="background:${clr}"></span>
                            <span class="db-chart-metodo-nombre">${lbl}</span>
                            <span class="db-chart-metodo-pct">${pct}%</span>
                            <span class="db-chart-metodo-cnt">(${cnt})</span>
                        </div>
                        <div class="db-chart-bar-bg" style="height:10px;border-radius:5px">
                            <div class="db-chart-bar-fill"
                                 style="width:${pct}%;height:10px;background:${clr};border-radius:5px"></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Cupones y Promociones
// ─────────────────────────────────────────────────────────────────────────────
let _cuponEdicionId = null;

function renderAdminCupones() {
    const cupones = obtenerCupones();
    const tbody   = document.getElementById('db-cupones-tbody');
    if (!tbody) return;

    if (cupones.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">
            <div class="db-empty">
                <i class="ri-coupon-line"></i>
                <p>No hay cupones creados aún.</p>
            </div>
        </td></tr>`;
        return;
    }

    const hoy = new Date();
    tbody.innerHTML = cupones.map(c => {
        const vencido  = c.fechaVence && new Date(c.fechaVence) < hoy;
        const tipoLbl  = c.tipo === 'porcentaje' ? `${c.valor}%` : formatearPrecio(c.valor);
        const minLbl   = c.minCompra > 0 ? formatearPrecio(c.minCompra) : '—';
        const usosLbl  = c.usoMaximo ? `${c.usosActuales}/${c.usoMaximo}` : `${c.usosActuales}/∞`;
        const venceLbl = c.fechaVence
            ? new Date(c.fechaVence).toLocaleDateString('es-CO')
            : '—';

        let estadoBadge;
        if (!c.activo) {
            estadoBadge = `<span class="db-badge db-badge--gris">Inactivo</span>`;
        } else if (vencido) {
            estadoBadge = `<span class="db-badge db-badge--rojo">Expirado</span>`;
        } else {
            estadoBadge = `<span class="db-badge db-badge--verde">Activo</span>`;
        }

        return `
        <tr style="${(!c.activo || vencido) ? 'opacity:0.6' : ''}">
            <td>
                <span class="db-cupon-codigo">${c.codigo}</span>
                ${c.descripcion ? `<div class="db-table__muted" style="font-size:0.72rem">${c.descripcion}</div>` : ''}
            </td>
            <td class="db-table__muted">
                ${c.tipo === 'porcentaje'
                    ? `<i class="ri-percent-line"></i> Porcentaje`
                    : `<i class="ri-money-dollar-circle-line"></i> Fijo`}
            </td>
            <td class="db-table__price">${tipoLbl}</td>
            <td class="db-table__muted">${minLbl}</td>
            <td class="db-table__muted">${usosLbl}</td>
            <td class="db-table__muted">${venceLbl}</td>
            <td>${estadoBadge}</td>
            <td>
                <div class="db-table__actions">
                    <button class="db-btn db-btn--sm db-btn--icon"
                            data-cupon-edit="${c.id}" title="Editar cupón">
                        <i class="ri-pencil-line"></i>
                    </button>
                    <button class="db-btn db-btn--sm db-btn--icon"
                            data-cupon-toggle="${c.id}"
                            title="${c.activo ? 'Desactivar' : 'Activar'}">
                        <i class="${c.activo ? 'ri-toggle-fill' : 'ri-toggle-line'}"
                           style="${c.activo ? 'color:#f97316' : 'color:var(--verde-principal)'}"></i>
                    </button>
                    <button class="db-btn db-btn--sm db-btn--icon db-btn--danger"
                            data-cupon-del="${c.id}" title="Eliminar cupón">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Eventos
    tbody.querySelectorAll('[data-cupon-edit]').forEach(btn => {
        btn.addEventListener('click', () => _abrirModalCupon(btn.dataset.cuponEdit));
    });
    tbody.querySelectorAll('[data-cupon-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const res = toggleCupon(btn.dataset.cuponToggle);
            if (res.ok) {
                toast(`Cupón ${res.activo ? 'activado' : 'desactivado'}`);
                renderAdminCupones();
            }
        });
    });
    tbody.querySelectorAll('[data-cupon-del]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('¿Eliminar este cupón permanentemente?')) return;
            const res = eliminarCupon(btn.dataset.cuponDel);
            if (res.ok) {
                toast('Cupón eliminado');
                renderAdminCupones();
            }
        });
    });
}

function _abrirModalCupon(couponId = null) {
    _cuponEdicionId = couponId;
    document.getElementById('db-cupon-form')?.reset();
    document.getElementById('db-cupon-id').value = '';

    const titulo = document.getElementById('db-cupon-modal-titulo');

    if (couponId) {
        const c = obtenerCupones().find(x => x.id === couponId);
        if (!c) return;
        if (titulo) titulo.textContent = 'Editar cupón';
        document.getElementById('db-cupon-id').value        = c.id;
        document.getElementById('db-cp-codigo').value        = c.codigo;
        document.getElementById('db-cp-tipo').value          = c.tipo;
        document.getElementById('db-cp-valor').value         = c.valor;
        document.getElementById('db-cp-mincompra').value     = c.minCompra ?? 0;
        document.getElementById('db-cp-usomax').value        = c.usoMaximo ?? '';
        document.getElementById('db-cp-vence').value         = c.fechaVence
            ? c.fechaVence.slice(0, 10) : '';
        document.getElementById('db-cp-descripcion').value   = c.descripcion ?? '';
    } else {
        if (titulo) titulo.textContent = 'Nuevo cupón';
    }

    document.getElementById('db-modal-cupon')
        ?.classList.add('db-modal-overlay--visible');
    setTimeout(() => document.getElementById('db-cp-codigo')?.focus(), 200);
}

function _cerrarModalCupon() {
    _cuponEdicionId = null;
    document.getElementById('db-modal-cupon')
        ?.classList.remove('db-modal-overlay--visible');
}

function _guardarCupon(e) {
    e.preventDefault();

    const codigo      = document.getElementById('db-cp-codigo').value.trim().toUpperCase();
    const tipo        = document.getElementById('db-cp-tipo').value;
    const valor       = Number(document.getElementById('db-cp-valor').value);
    const minCompra   = Number(document.getElementById('db-cp-mincompra').value) || 0;
    const usoMax      = document.getElementById('db-cp-usomax').value;
    const fechaVence  = document.getElementById('db-cp-vence').value || null;
    const descripcion = document.getElementById('db-cp-descripcion').value.trim();

    if (!codigo || !tipo || !valor) {
        toast('Completa los campos obligatorios (*)', 'error');
        return;
    }

    const idEnEdicion = document.getElementById('db-cupon-id').value;

    let resultado;
    if (idEnEdicion) {
        resultado = actualizarCupon(idEnEdicion, {
            codigo, tipo, valor, minCompra,
            usoMaximo:  usoMax ? Number(usoMax) : null,
            fechaVence, descripcion,
        });
    } else {
        resultado = crearCupon({
            codigo, tipo, valor, minCompra,
            usoMaximo:  usoMax ? Number(usoMax) : null,
            fechaVence, descripcion,
        });
    }

    if (!resultado.ok) {
        const errMsg = {
            DUPLICATE_CODE: 'Este código ya existe.',
            MISSING_FIELDS: 'Completa todos los campos requeridos.',
            FORBIDDEN:      'Sin permisos de administrador.',
        };
        toast(errMsg[resultado.error] ?? 'Error al guardar el cupón', 'error');
        return;
    }

    toast(idEnEdicion ? 'Cupón actualizado' : 'Cupón creado correctamente');
    _cerrarModalCupon();
    renderAdminCupones();
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
async function handleLogout() {
    await logout();
    window.location.replace(RUTAS.HOME);
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Modal Editar Usuario
// ─────────────────────────────────────────────────────────────────────────────

// Mensajes de error legibles para el modal de usuario
const USR_ERROR_MSG = {
    FORBIDDEN:      'No tienes permisos para realizar esta acción.',
    USER_NOT_FOUND: 'Usuario no encontrado.',
    EMAIL_IN_USE:   'Este correo ya está registrado por otro usuario.',
    INVALID_EMAIL:  'Ingresa un correo electrónico válido.',
    EMPTY_FIELDS:   'El nombre y el correo son obligatorios.',
    LAST_ADMIN:     'No puedes quitarte el rol de administrador si eres el único admin del sistema.',
    WEAK_PASSWORD:  'La nueva contraseña debe tener al menos 6 caracteres.',
};

function _modalEditarUsuario(abrir) {
    const el = document.getElementById('db-modal-usuario');
    if (!el) return;
    el.classList.toggle('db-modal-overlay--visible', abrir);

    if (!abrir) {
        // Limpiar alerta y hints al cerrar
        _usrOcultarAlerta();
        document.getElementById('db-usr-pass-hint').textContent = '';
        document.getElementById('db-usr-password').type = 'password';
        document.getElementById('db-usr-toggle-pass')
            .querySelector('i').className = 'ri-eye-line';
    }
}

function _usrMostrarAlerta(msg) {
    const el   = document.getElementById('db-usr-alerta');
    const span = document.getElementById('db-usr-alerta-texto');
    if (!el || !span) return;
    span.textContent = msg;
    el.style.display = 'flex';
}

function _usrOcultarAlerta() {
    const el = document.getElementById('db-usr-alerta');
    if (el) el.style.display = 'none';
}

function abrirModalEditarUsuario(userId) {
    const users = getUsers();
    const u     = users.find(x => x.id === userId);
    if (!u) { toast('Usuario no encontrado', 'error'); return; }

    // Rellenar campos con los datos actuales
    document.getElementById('db-usr-form')?.reset();
    _usrOcultarAlerta();

    document.getElementById('db-usr-id').value       = u.id;
    document.getElementById('db-usr-nombre').value   = u.name;
    document.getElementById('db-usr-email').value    = u.email;
    document.getElementById('db-usr-telefono').value = u.phone ?? '';
    document.getElementById('db-usr-rol').value      = u.role;
    document.getElementById('db-usr-password').value = '';
    document.getElementById('db-usr-pass-hint').textContent = '';

    // Si es el único admin, bloquear el selector de rol para evitar
    // que se quite accidentalmente el rol admin
    const rolSelect    = document.getElementById('db-usr-rol');
    const totalAdmins  = users.filter(x => x.role === ROLES.ADMIN).length;
    const esUnicoAdmin = u.role === ROLES.ADMIN && totalAdmins === 1;
    rolSelect.disabled = esUnicoAdmin;
    rolSelect.title    = esUnicoAdmin
        ? 'No puedes cambiar el rol: eres el único administrador'
        : '';

    _modalEditarUsuario(true);
    setTimeout(() => document.getElementById('db-usr-nombre')?.focus(), 200);
}

function guardarUsuarioAdmin(e) {
    e.preventDefault();
    _usrOcultarAlerta();

    const userId       = document.getElementById('db-usr-id').value;
    const name         = document.getElementById('db-usr-nombre').value.trim();
    const email        = document.getElementById('db-usr-email').value.trim();
    const phone        = document.getElementById('db-usr-telefono').value.trim();
    const role         = document.getElementById('db-usr-rol').value;
    const nuevaPassword= document.getElementById('db-usr-password').value;

    // Validación rápida en cliente antes de llamar al servicio
    if (!name) {
        _usrMostrarAlerta('El nombre completo es obligatorio.');
        document.getElementById('db-usr-nombre').focus();
        return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        _usrMostrarAlerta('Ingresa un correo electrónico válido.');
        document.getElementById('db-usr-email').focus();
        return;
    }
    if (nuevaPassword && nuevaPassword.length < 6) {
        _usrMostrarAlerta('La nueva contraseña debe tener al menos 6 caracteres.');
        document.getElementById('db-usr-password').focus();
        return;
    }

    // Deshabilitar botón mientras se procesa
    const btnGuardar = document.getElementById('db-usr-modal-guardar');
    if (btnGuardar) btnGuardar.disabled = true;

    const resultado = actualizarUsuarioPorAdmin(userId, {
        name, email, phone, role,
        nuevaPassword: nuevaPassword || undefined,
    });

    if (btnGuardar) btnGuardar.disabled = false;

    if (!resultado.ok) {
        const msg = USR_ERROR_MSG[resultado.error] ?? 'Error inesperado. Intenta de nuevo.';
        _usrMostrarAlerta(msg);
        return;
    }

    // Éxito: actualizar referencias en memoria y re-renderizar tabla
    _modalEditarUsuario(false);
    renderAdminUsuarios();

    // Si el usuario editado era el admin activo, actualizar sidebar
    if (resultado.user.id === session.id) {
        session = { ...session, name: resultado.user.name, email: resultado.user.email };
        renderSidebarUser();
    }

    toast(`Usuario "${resultado.user.name}" actualizado correctamente`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Confirmar acciones sobre usuario (toggle + eliminar)
// ─────────────────────────────────────────────────────────────────────────────

// Estado interno del confirm de usuario
let _usrConfirmTarget  = null; // userId
let _usrConfirmAccion  = null; // 'toggle' | 'delete'

/**
 * Abre el modal de confirmación adaptando su contenido según la acción.
 * @param {'toggle'|'delete'} accion
 * @param {string} userId
 */
function _abrirConfirmUsuario(accion, userId) {
    const users      = getUsers();
    const u          = users.find(x => x.id === userId);
    if (!u) return;

    const userOrders  = getOrders().filter(o => o.userId === userId);
    const tieneOrders = userOrders.length > 0;
    const esActivo    = (u.status ?? STATUS.ACTIVE) === STATUS.ACTIVE;

    _usrConfirmTarget = userId;
    _usrConfirmAccion = accion;

    // Adaptar contenido del modal según la acción
    const iconEl  = document.getElementById('db-cusr-icono');
    const titleEl = document.getElementById('db-cusr-titulo');
    const textEl  = document.getElementById('db-cusr-texto');
    const warnEl  = document.getElementById('db-cusr-advertencia');
    const warnTxt = document.getElementById('db-cusr-advertencia-texto');
    const btnSi   = document.getElementById('db-cusr-si');
    const btnIcon = document.getElementById('db-cusr-si-icon');
    const btnLbl  = document.getElementById('db-cusr-si-label');

    if (accion === 'toggle') {
        iconEl.innerHTML  = esActivo
            ? `<i class="ri-user-forbid-line" style="color:#f97316"></i>`
            : `<i class="ri-user-follow-line" style="color:var(--verde-principal)"></i>`;
        titleEl.textContent = esActivo ? 'Inactivar usuario' : 'Activar usuario';
        textEl.textContent  = esActivo
            ? `¿Inactivar la cuenta de "${u.name}"? No podrá iniciar sesión hasta que sea reactivada.`
            : `¿Reactivar la cuenta de "${u.name}"? Podrá volver a iniciar sesión.`;
        btnSi.style.background   = esActivo ? '#f97316' : 'var(--verde-principal)';
        btnSi.style.borderColor  = esActivo ? '#f97316' : 'var(--verde-principal)';
        btnIcon.className        = esActivo ? 'ri-forbid-line' : 'ri-checkbox-circle-line';
        btnLbl.textContent       = esActivo ? 'Sí, inactivar' : 'Sí, activar';
        warnEl.style.display     = 'none';

    } else { // delete
        iconEl.innerHTML  = `<i class="ri-delete-bin-5-line" style="color:#ef4444"></i>`;
        titleEl.textContent = 'Eliminar usuario';
        textEl.textContent  = `¿Eliminar permanentemente la cuenta de "${u.name}"? Esta acción no se puede deshacer.`;
        btnSi.style.background  = '#ef4444';
        btnSi.style.borderColor = '#ef4444';
        btnIcon.className       = 'ri-delete-bin-line';
        btnLbl.textContent      = 'Sí, eliminar';

        // Advertencia si tiene historial de pedidos
        if (tieneOrders) {
            warnEl.style.display  = 'flex';
            warnTxt.textContent   =
                `Este usuario tiene ${userOrders.length} pedido(s) en el historial. ` +
                `Se recomienda Inactivar en lugar de eliminar para conservar el registro de ventas.`;
        } else {
            warnEl.style.display = 'none';
        }
    }

    // Abrir modal
    document.getElementById('db-confirm-usuario')
        ?.classList.add('db-confirm-overlay--visible');
}

function _cerrarConfirmUsuario() {
    _usrConfirmTarget = null;
    _usrConfirmAccion = null;
    document.getElementById('db-confirm-usuario')
        ?.classList.remove('db-confirm-overlay--visible');
}

function _ejecutarConfirmUsuario() {
    if (!_usrConfirmTarget || !_usrConfirmAccion) return;

    if (_usrConfirmAccion === 'toggle') {
        const res = toggleUserStatus(_usrConfirmTarget);
        if (!res.ok) {
            const msgs = {
                SELF_ACTION:       'No puedes cambiar el estado de tu propia sesión.',
                PROTECTED_ACCOUNT: 'Esta cuenta está protegida y no puede ser modificada.',
                USER_NOT_FOUND:    'Usuario no encontrado.',
                FORBIDDEN:         'No tienes permisos para esta acción.',
            };
            toast(msgs[res.error] ?? 'Error inesperado.', 'error');
        } else {
            const estado = res.newStatus === STATUS.ACTIVE ? 'activado' : 'inactivado';
            toast(`Usuario "${res.user.name}" ${estado} correctamente`);
            renderAdminUsuarios();
        }
    } else {
        const res = deleteUserById(_usrConfirmTarget);
        if (!res.ok) {
            const msgs = {
                SELF_ACTION:       'No puedes eliminar tu propia cuenta.',
                PROTECTED_ACCOUNT: 'La cuenta de administrador principal no puede eliminarse.',
                USER_NOT_FOUND:    'Usuario no encontrado.',
                FORBIDDEN:         'No tienes permisos para esta acción.',
            };
            toast(msgs[res.error] ?? 'Error inesperado.', 'error');
        } else {
            toast('Usuario eliminado permanentemente');
            renderAdminUsuarios();
        }
    }

    _cerrarConfirmUsuario();
}

// Alias semánticos llamados desde los botones de la tabla
function pedirConfirmToggleUsuario(userId)  { _abrirConfirmUsuario('toggle', userId); }
function pedirConfirmEliminarUsuario(userId) { _abrirConfirmUsuario('delete', userId); }

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN PRINCIPAL — punto de entrada
// ─────────────────────────────────────────────────────────────────────────────
export async function iniciarDashboard() {
    session = getSession();
    await ensureProductosLoaded();
    productos = obtenerProductos();

    if (session?.role === ROLES.ADMIN) {
        await refreshUsersCache();
        await refreshCuponesCache();
        _ordersCache = await obtenerTodasLasOrdenes();
    } else if (session?.id) {
        _ordersCache = await obtenerOrdenesPorUsuario(session.id);
    }

    const isAdminRole = session?.role === ROLES.ADMIN;
    const isClient    = session?.role === ROLES.CLIENT;

    // ── RBAC: limpieza estricta del DOM según rol ─────────────────────────
    // No usamos display:none — removemos físicamente los nodos no permitidos
    // para que no sean accesibles por JS ni por inspección de elementos.
    if (isClient) {
        // Eliminar del DOM el panel completo de administración y su nav
        document.getElementById('db-panel-admin')?.remove();
        document.getElementById('db-nav-admin')?.remove();
    } else if (isAdminRole) {
        // Eliminar del DOM el panel de cliente y su nav
        document.getElementById('db-panel-cliente')?.remove();
        document.getElementById('db-nav-cliente')?.remove();
    }

    // ── 1. Render sidebar de usuario ──────────────────────────────────────
    renderSidebarUser();

    // ── 2. Poblar bloque de bienvenida del panel correcto ─────────────────
    const ini = iniciales(session.name);

    if (isAdminRole) {
        const avEl = document.getElementById('db-welcome-avatar-admin');
        const nbEl = document.getElementById('db-welcome-nombre-admin');
        const sbEl = document.getElementById('db-welcome-sub-admin');
        if (avEl) avEl.textContent = ini;
        if (nbEl) nbEl.textContent = `¡Hola, ${session.name.split(' ')[0]}!`;
        if (sbEl) sbEl.textContent = 'Gestiona productos, pedidos y clientes de la tienda.';
    } else {
        const avEl = document.getElementById('db-welcome-avatar');
        const nbEl = document.getElementById('db-welcome-nombre');
        const sbEl = document.getElementById('db-welcome-sub');
        if (avEl) avEl.textContent = ini;
        if (nbEl) nbEl.textContent = `¡Hola, ${session.name.split(' ')[0]}!`;
        if (sbEl) sbEl.textContent = 'Bienvenida a tu panel personal. Gestiona tus pedidos y perfil.';
    }

    // ── 3. Renderizado inicial según rol ──────────────────────────────────
    if (isAdminRole) {
        renderAdminResumen();
        activarVista('admin-resumen');
    } else {
        // Iniciar Quick View una vez para el panel de cliente
        iniciarQuickView();
        renderClienteResumen();
        activarVista('resumen');
    }

    // ── 4. Whitelist de vistas permitidas por rol ─────────────────────────
    // Si un cliente llega a tener en memoria algún botón de admin (ej. por
    // caché agresivo), el guard de esta lista lo bloquea antes de renderizar.
    const VISTAS_CLIENTE = new Set(['resumen','perfil','pedidos','favoritos']);
    const VISTAS_ADMIN   = new Set([
        'admin-resumen','admin-productos','admin-pedidos','admin-usuarios',
        'admin-inventario','admin-analitica','admin-cupones',
    ]);
    const vistasPermitidas = isAdminRole ? VISTAS_ADMIN : VISTAS_CLIENTE;

    // ── 5. Eventos del sidebar — navegación con guard de rol ──────────────
    document.querySelectorAll('.db-nav__item').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (!view) return;

            // Intento de acceder a una vista no permitida para este rol
            if (!vistasPermitidas.has(view)) {
                _mostrarAccesoDenegado();
                return;
            }

            activarVista(view);

            const renders = {
                'resumen':          () => renderClienteResumen(),
                'perfil':           () => renderClientePerfil(),
                'pedidos':          () => renderClientePedidos(),
                'favoritos':        () => renderClienteFavoritos(),
                'admin-resumen':    () => renderAdminResumen(),
                'admin-productos':  () => renderAdminProductos(),
                'admin-pedidos':    () => renderAdminPedidos(),
                'admin-usuarios':   () => renderAdminUsuarios(),
                'admin-inventario': () => renderAdminInventario(),
                'admin-analitica':  () => renderAdminAnalitica(),
                'admin-cupones':    () => renderAdminCupones(),
            };
            renders[view]?.();

            // Cerrar sidebar en móvil al seleccionar una vista
            if (window.innerWidth < 900) cerrarSidebarMovil();
        });
    });

    // ── 6. Botones de logout ──────────────────────────────────────────────
    document.querySelectorAll('[data-db-logout]').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });

    // ── 7. Botón de menú móvil ────────────────────────────────────────────
    document.getElementById('db-menu-btn')?.addEventListener('click', toggleSidebar);

    // ── 14. Escape global ─────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            _modalProducto(false);
            cerrarConfirm();
            cerrarSidebarMovil();
        }
    });

    // ── 8. Formulario de perfil (solo cliente) ────────────────────────────
    document.getElementById('db-form-perfil')?.addEventListener('submit', guardarPerfil);

    // ── 9. Búsqueda de productos (solo admin) ─────────────────────────────
    document.getElementById('db-prod-buscar')?.addEventListener('input', e => {
        filtroProductos = e.target.value.toLowerCase();
        _pintarTablaProductos();
    });

    // ── 10. Botón Nuevo producto (solo admin) ─────────────────────────────
    document.getElementById('db-prod-nuevo')?.addEventListener('click', () => {
        if (!isAdminRole) { _mostrarAccesoDenegado(); return; }
        abrirModalProducto();
    });

    // ── 11. Modal producto — cerrar ────────────────────────────────────────
    ['db-prod-modal-cerrar','db-prod-modal-cancelar'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => _modalProducto(false));
    });
    document.getElementById('db-modal-producto')?.addEventListener('click', e => {
        if (e.target === document.getElementById('db-modal-producto')) _modalProducto(false);
    });

    // ── 12. Form producto — submit (solo admin) ───────────────────────────
    document.getElementById('db-prod-form')?.addEventListener('submit', e => {
        e.preventDefault();
        if (!isAdminRole) { _mostrarAccesoDenegado(); return; }
        guardarProducto();
    });

    // ── 13. Confirm eliminar ───────────────────────────────────────────────
    document.getElementById('db-confirm-si')?.addEventListener('click', () => {
        if (!isAdminRole) { cerrarConfirm(); return; }
        confirmarEliminar();
    });
    document.getElementById('db-confirm-no')?.addEventListener('click', cerrarConfirm);
    document.getElementById('db-confirm')?.addEventListener('click', e => {
        if (e.target === document.getElementById('db-confirm')) cerrarConfirm();
    });

    // ── 16. Modal editar usuario + confirmar acciones (solo admin) ───────
    if (isAdminRole) {
        // ── Confirm acción usuario (toggle/delete) ──────────────────────
        document.getElementById('db-cusr-no')
            ?.addEventListener('click', _cerrarConfirmUsuario);
        document.getElementById('db-cusr-si')
            ?.addEventListener('click', _ejecutarConfirmUsuario);
        document.getElementById('db-confirm-usuario')
            ?.addEventListener('click', e => {
                if (e.target === document.getElementById('db-confirm-usuario')) {
                    _cerrarConfirmUsuario();
                }
            });

        // ── Modal editar datos ───────────────────────────────────────────
        // Cerrar modal
        ['db-usr-modal-cerrar', 'db-usr-modal-cancelar'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => _modalEditarUsuario(false));
        });
        // Cerrar al clic en backdrop
        document.getElementById('db-modal-usuario')?.addEventListener('click', e => {
            if (e.target === document.getElementById('db-modal-usuario')) {
                _modalEditarUsuario(false);
            }
        });

        // Submit del formulario
        document.getElementById('db-usr-form')
            ?.addEventListener('submit', guardarUsuarioAdmin);

        // Toggle visibilidad contraseña
        document.getElementById('db-usr-toggle-pass')?.addEventListener('click', () => {
            const input = document.getElementById('db-usr-password');
            const icon  = document.getElementById('db-usr-toggle-pass').querySelector('i');
            const ver   = input.type === 'password';
            input.type  = ver ? 'text' : 'password';
            icon.className = ver ? 'ri-eye-off-line' : 'ri-eye-line';
        });

        // Hint de fortaleza en tiempo real
        document.getElementById('db-usr-password')?.addEventListener('input', e => {
            const val  = e.target.value;
            const hint = document.getElementById('db-usr-pass-hint');
            if (!val) { hint.textContent = ''; hint.style.color = ''; return; }
            if (val.length < 6) {
                hint.textContent = '⚠ Mínimo 6 caracteres';
                hint.style.color = '#ef4444';
            } else if (val.length < 10 || !/[A-Z]/.test(val) || !/[0-9]/.test(val)) {
                hint.textContent = '✓ Contraseña aceptable';
                hint.style.color = '#f59e0b';
            } else {
                hint.textContent = '✓ Contraseña segura';
                hint.style.color = 'var(--verde-principal)';
            }
        });
    }

    // ── 14. Escape global ─────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            _modalProducto(false);
            _modalEditarUsuario(false);
            _cerrarModalCupon();
            cerrarConfirm();
            _cerrarConfirmUsuario();
            cerrarSidebarMovil();
        }
    });

    // ── 15. Escuchar cambios de favoritos en otras pestañas ────────────────
    window.addEventListener('storage', (e) => {
        if (e.key === KEYS.FAVORITES && viewActual === 'favoritos') {
            renderClienteFavoritos();
        }
    });

    // ── 17. Módulos extra de admin ─────────────────────────────────────────
    if (isAdminRole) {
        // Umbral y búsqueda de inventario
        document.getElementById('db-inv-umbral-input')?.addEventListener('change', e => {
            umbralStock = Math.max(1, parseInt(e.target.value) || 5);
            if (viewActual === 'admin-inventario') renderAdminInventario();
        });
        document.getElementById('db-inv-buscar')?.addEventListener('input', () => {
            if (viewActual === 'admin-inventario') renderAdminInventario();
        });

        // Cupón: nuevo
        document.getElementById('db-cupon-nuevo')
            ?.addEventListener('click', () => _abrirModalCupon());
        // Cupón: cerrar modal
        ['db-cupon-modal-cerrar', 'db-cupon-modal-cancelar'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', _cerrarModalCupon);
        });
        document.getElementById('db-modal-cupon')?.addEventListener('click', e => {
            if (e.target === document.getElementById('db-modal-cupon')) _cerrarModalCupon();
        });
        // Cupón: submit
        document.getElementById('db-cupon-form')
            ?.addEventListener('submit', _guardarCupon);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCESO DENEGADO — toast + bloqueo visual
// ─────────────────────────────────────────────────────────────────────────────
function _mostrarAccesoDenegado() {
    toast('Acceso denegado: no tienes permisos para esta sección.', 'error');
    console.warn('[Dashboard RBAC] Intento de acceso a sección no autorizada bloqueado.');
}
