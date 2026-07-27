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
    getSession, logout, AUTH_KEYS, ROLES,
} from '../utils/authService.js';
import Storage from '../utils/storage.js';
import { STORAGE_KEYS, RUTAS, waLink } from '../utils/constants.js';
import {
    obtenerProductos, guardarProductos,
    generarId, formatearPrecio, CATEGORIAS, ETIQUETAS,
} from '../data/productos.data.js';

// ── Storage keys adicionales ───────────────────────────────────────────────
const KEYS = {
    ORDERS:    'maye_orders',
    FAVORITES: 'maye_favorites',
};

// ── Estado del módulo ──────────────────────────────────────────────────────
let session        = null;
let productos      = [];
let toastTimer     = null;
let productoTarget = null; // id a eliminar
let viewActual     = '';

// ── Helpers de datos ───────────────────────────────────────────────────────
function getOrders()    { return Storage.obtener(KEYS.ORDERS,    []); }
function saveOrders(o)  { Storage.guardar(KEYS.ORDERS,    o); }
function getFavorites() { return Storage.obtener(KEYS.FAVORITES, []); }
function getUsers()     { return Storage.obtener(AUTH_KEYS.USERS, []); }

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
        'admin-resumen':   'Resumen General',
        'admin-productos': 'Gestión de Productos',
        'admin-pedidos':   'Gestión de Pedidos',
        'admin-usuarios':  'Gestión de Usuarios',
    };
    const tb = document.getElementById('db-topbar-titulo');
    if (tb) tb.textContent = titulos[viewId] ?? 'Dashboard';
    viewActual = viewId;
}

// ── Sidebar toggle (responsive) ────────────────────────────────────────────
function toggleSidebar() {
    document.getElementById('db-sidebar')?.classList.toggle('db-sidebar--abierto');
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
    const favs   = getFavorites();
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
    const recientes = [...orders].sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 3);
    const listEl = document.getElementById('db-client-pedidos-recientes');
    if (!listEl) return;
    if (recientes.length === 0) {
        listEl.innerHTML = `<div class="db-empty"><i class="ri-inbox-line"></i><p>Aún no tienes pedidos</p></div>`;
        return;
    }
    listEl.innerHTML = recientes.map(o => pedidoCardHTML(o)).join('');
}

// ── Vista: Perfil del cliente ──────────────────────────────────────────────
function renderClientePerfil() {
    const users = getUsers();
    const user  = users.find(u => u.id === session.id) ?? {};
    document.getElementById('pf-nombre').value    = user.name    ?? session.name;
    document.getElementById('pf-email').value     = user.email   ?? session.email;
    document.getElementById('pf-telefono').value  = user.phone   ?? '';
    document.getElementById('pf-direccion').value = user.address ?? '';
    document.getElementById('pf-ciudad').value    = user.city    ?? '';
}

function guardarPerfil(e) {
    e.preventDefault();
    const users = getUsers();
    const idx   = users.findIndex(u => u.id === session.id);
    if (idx === -1) return;

    users[idx] = {
        ...users[idx],
        name:    document.getElementById('pf-nombre').value.trim(),
        phone:   document.getElementById('pf-telefono').value.trim(),
        address: document.getElementById('pf-direccion').value.trim(),
        city:    document.getElementById('pf-ciudad').value.trim(),
    };
    Storage.guardar(AUTH_KEYS.USERS, users);

    // Actualizar la sesión local con el nombre nuevo
    const newSession = { ...session, name: users[idx].name };
    Storage.guardar(AUTH_KEYS.SESSION, newSession);
    session = newSession;
    renderSidebarUser();

    toast('Perfil actualizado correctamente');
}

// ── Vista: Pedidos del cliente ─────────────────────────────────────────────
function renderClientePedidos() {
    const orders = getOrders()
        .filter(o => o.userId === session.id)
        .sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    const el = document.getElementById('db-client-orders-list');
    if (!el) return;
    el.innerHTML = orders.length === 0
        ? `<div class="db-empty"><i class="ri-inbox-line"></i><p>Aún no tienes pedidos. <a href="${RUTAS.PRODUCTOS}" style="color:var(--verde-principal)">¡Explora la tienda!</a></p></div>`
        : orders.map(o => pedidoCardHTML(o)).join('');
}

function pedidoCardHTML(o) {
    const estadoCls = { pendiente:'db-badge--amarillo', enviado:'db-badge--azul', completado:'db-badge--verde', cancelado:'db-badge--rojo' };
    const estadoLabel = { pendiente:'Pendiente', enviado:'Enviado', completado:'Completado', cancelado:'Cancelado' };
    const items = (o.items ?? []).map(it => `
        <div class="db-pedido-item">
            <img src="${it.imagen}" alt="${it.nombre}"
                 onerror="this.src='https://placehold.co/40x40/FAF7F2/2A8C64?text=?'">
            <span class="db-pedido-item__nombre">${it.nombre}</span>
            <span class="db-pedido-item__qty">× ${it.cantidad}</span>
            <span class="db-pedido-item__precio">${formatearPrecio(it.precio * it.cantidad)}</span>
        </div>`).join('');

    return `
    <div class="db-pedido-card">
        <div class="db-pedido-card__head">
            <span class="db-pedido-card__id"><i class="ri-file-list-3-line"></i> Pedido #${o.id}</span>
            <span class="db-pedido-card__fecha">${fmtFecha(o.fecha)}</span>
            <span class="db-badge ${estadoCls[o.estado] ?? 'db-badge--gris'}">${estadoLabel[o.estado] ?? o.estado}</span>
            <span class="db-pedido-card__total">${formatearPrecio(o.total ?? 0)}</span>
        </div>
        ${items ? `<div class="db-pedido-card__body">${items}</div>` : ''}
    </div>`;
}

// ── Vista: Favoritos del cliente ───────────────────────────────────────────
function renderClienteFavoritos() {
    const favIds = getFavorites();
    const prods  = obtenerProductos().filter(p => favIds.includes(p.id));
    const el     = document.getElementById('db-client-favs-grid');
    if (!el) return;

    if (prods.length === 0) {
        el.innerHTML = `<div class="db-empty" style="grid-column:1/-1">
            <i class="ri-heart-3-line"></i>
            <p>Tu lista de deseos está vacía. <a href="${RUTAS.PRODUCTOS}" style="color:var(--verde-principal)">Descubre productos</a></p>
        </div>`;
        return;
    }

    el.innerHTML = prods.map(p => `
    <div class="db-fav-card">
        <img src="${p.imagen}" alt="${p.nombre}"
             onerror="this.src='https://placehold.co/180x180/FAF7F2/2A8C64?text=?'">
        <div class="db-fav-card__body">
            <div class="db-fav-card__nombre">${p.nombre}</div>
            <div class="db-fav-card__precio">${formatearPrecio(p.precio)}</div>
        </div>
        <div class="db-fav-card__footer">
            <a href="${RUTAS.PRODUCTOS}" class="db-btn db-btn--primary db-btn--sm" style="flex:1;justify-content:center;text-decoration:none">
                <i class="ri-shopping-cart-line"></i> Comprar
            </a>
            <button class="db-btn db-btn--danger db-btn--sm db-btn--icon"
                    data-rm-fav="${p.id}" title="Quitar de favoritos">
                <i class="ri-heart-3-line"></i>
            </button>
        </div>
    </div>`).join('');

    el.querySelectorAll('[data-rm-fav]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id  = Number(btn.dataset.rmFav);
            const fav = getFavorites().filter(f => f !== id);
            Storage.guardar(KEYS.FAVORITES, fav);
            renderClienteFavoritos();
            toast('Producto eliminado de favoritos');
        });
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
    tBody.innerHTML = recientes.map(o => `
    <tr>
        <td class="db-table__bold">#${o.id}</td>
        <td>${o.clienteName ?? '—'}</td>
        <td>${fmtFecha(o.fecha)}</td>
        <td class="db-table__price">${formatearPrecio(o.total??0)}</td>
        <td>${badge(o)}</td>
    </tr>`).join('');
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
function renderAdminPedidos() {
    const orders = [...getOrders()].sort((a,b) => new Date(b.fecha)-new Date(a.fecha));
    const tbody  = document.getElementById('db-orders-tbody');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="db-empty"><i class="ri-inbox-line"></i><p>No hay pedidos registrados</p></div></td></tr>`;
        return;
    }

    const estadoOpts = ['pendiente','enviado','completado','cancelado']
        .map(s => `<option value="${s}">${{pendiente:'Pendiente',enviado:'Enviado',completado:'Completado',cancelado:'Cancelado'}[s]}</option>`)
        .join('');

    tbody.innerHTML = orders.map(o => {
        const badge = { pendiente:'db-badge--amarillo', enviado:'db-badge--azul', completado:'db-badge--verde', cancelado:'db-badge--rojo' };
        return `
        <tr>
            <td class="db-table__bold">#${o.id}</td>
            <td>${o.clienteName ?? '—'}<br><span class="db-table__muted">${o.clienteEmail ?? ''}</span></td>
            <td>${fmtFecha(o.fecha)}</td>
            <td class="db-table__price">${formatearPrecio(o.total??0)}</td>
            <td>${(o.items??[]).length} ítem(s)</td>
            <td><span class="db-badge ${badge[o.estado]??'db-badge--gris'}">${o.estado}</span></td>
            <td>
                <select class="db-status-select" data-order-id="${o.id}">
                    ${estadoOpts.replace(`value="${o.estado}"`,`value="${o.estado}" selected`)}
                </select>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-order-id]').forEach(sel => {
        sel.addEventListener('change', () => {
            const all = getOrders();
            const idx = all.findIndex(o => String(o.id) === String(sel.dataset.orderId));
            if (idx !== -1) {
                all[idx].estado = sel.value;
                saveOrders(all);
                toast(`Pedido #${sel.dataset.orderId} → ${sel.value}`, 'info');
                // re-render badge inline
                const row = sel.closest('tr');
                const badgeCls = { pendiente:'db-badge--amarillo', enviado:'db-badge--azul', completado:'db-badge--verde', cancelado:'db-badge--rojo' };
                const badgeEl = row?.querySelector('.db-badge');
                if (badgeEl) {
                    badgeEl.className = `db-badge ${badgeCls[sel.value]??'db-badge--gris'}`;
                    badgeEl.textContent = sel.value;
                }
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL ADMIN — Usuarios
// ─────────────────────────────────────────────────────────────────────────────
function renderAdminUsuarios() {
    const users  = getUsers().filter(u => u.role === ROLES.CLIENT);
    const orders = getOrders();
    const tbody  = document.getElementById('db-users-tbody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="db-empty"><i class="ri-user-3-line"></i><p>No hay clientes registrados</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const userOrders = orders.filter(o => o.userId === u.id);
        const total      = userOrders.reduce((s,o) => s + (o.total??0), 0);
        const ini        = iniciales(u.name);
        return `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <div class="db-sidebar__avatar" style="width:34px;height:34px;font-size:0.75rem;flex-shrink:0">${ini}</div>
                    <div>
                        <div class="db-table__bold">${u.name}</div>
                        <div class="db-table__muted">${u.email}</div>
                    </div>
                </div>
            </td>
            <td class="db-table__muted">${u.phone || '—'}</td>
            <td>${fmtFecha(u.createdAt)}</td>
            <td>${userOrders.length}</td>
            <td class="db-table__price">${formatearPrecio(total)}</td>
            <td><span class="db-badge db-badge--verde">Activo</span></td>
        </tr>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
async function handleLogout() {
    await logout();
    window.location.replace(RUTAS.HOME);
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN PRINCIPAL — punto de entrada
// ─────────────────────────────────────────────────────────────────────────────
export function iniciarDashboard() {
    session   = getSession();
    productos = obtenerProductos();

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
        renderClienteResumen();
        activarVista('resumen');
    }

    // ── 4. Whitelist de vistas permitidas por rol ─────────────────────────
    // Si un cliente llega a tener en memoria algún botón de admin (ej. por
    // caché agresivo), el guard de esta lista lo bloquea antes de renderizar.
    const VISTAS_CLIENTE = new Set(['resumen','perfil','pedidos','favoritos']);
    const VISTAS_ADMIN   = new Set(['admin-resumen','admin-productos','admin-pedidos','admin-usuarios']);
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
            };
            renders[view]?.();

            if (window.innerWidth < 900) {
                document.getElementById('db-sidebar')?.classList.remove('db-sidebar--abierto');
            }
        });
    });

    // ── 6. Botones de logout ──────────────────────────────────────────────
    document.querySelectorAll('[data-db-logout]').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });

    // ── 7. Botón de menú móvil ────────────────────────────────────────────
    document.getElementById('db-menu-btn')?.addEventListener('click', toggleSidebar);

    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('db-sidebar');
        const menuBtn = document.getElementById('db-menu-btn');
        if (window.innerWidth < 900 && sidebar?.classList.contains('db-sidebar--abierto')) {
            if (!sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
                sidebar.classList.remove('db-sidebar--abierto');
            }
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

    // ── 14. Escape global ─────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            _modalProducto(false);
            cerrarConfirm();
            document.getElementById('db-sidebar')?.classList.remove('db-sidebar--abierto');
        }
    });

    // ── 15. Escuchar cambios de favoritos en otras pestañas ────────────────
    window.addEventListener('storage', (e) => {
        if (e.key === KEYS.FAVORITES && viewActual === 'favoritos') {
            renderClienteFavoritos();
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCESO DENEGADO — toast + bloqueo visual
// ─────────────────────────────────────────────────────────────────────────────
function _mostrarAccesoDenegado() {
    toast('Acceso denegado: no tienes permisos para esta sección.', 'error');
    console.warn('[Dashboard RBAC] Intento de acceso a sección no autorizada bloqueado.');
}
