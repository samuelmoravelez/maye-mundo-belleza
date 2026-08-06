// js/pages/producto.js
// Lógica de la página de detalle de producto.
//
// CORRECCIÓN DE BUG (race condition):
//   obtenerProductos() es síncrono y devuelve el caché interno de productService.
//   Si se llama antes de que ensureProductosLoaded() resuelva, el caché está vacío
//   y productos.find() no halla nada → "Producto no encontrado".
//
//   La solución vive en entry-producto.js: se hace await ensureProductosLoaded()
//   antes de llamar a iniciarDetalleProducto(). Esta función ya NO necesita ser
//   async: cuando se invoca, el caché está garantizadamente poblado.
//
//   Se mantiene, no obstante, un fallback defensivo dentro de esta misma función
//   para el caso en que alguien la importe desde otro contexto sin el prefetch.

import {
    obtenerProductos,
    ensureProductosLoaded,
    formatearPrecio,
    CATEGORIAS,
    ETIQUETAS,
} from '../data/productos.data.js';
import { agregarItem } from '../utils/carrito.js';
import { waLink }      from '../utils/constants.js';

// ── HELPERS ────────────────────────────────────────────────────────────────────
const CAT_LABELS = {};
CATEGORIAS.forEach(c => { CAT_LABELS[c.id] = c.label; });
function categoriaLabel(cat) { return CAT_LABELS[cat] ?? cat; }

// ── INICIALIZACIÓN ─────────────────────────────────────────────────────────────
export function iniciarDetalleProducto() {
    const contenedor = document.getElementById('producto-principal');
    if (!contenedor) return;

    // Leer ?id= de la URL
    const params  = new URLSearchParams(window.location.search);
    const idBruto = params.get('id');
    const id      = Number(idBruto);

    // Intentar con el caché síncrono primero (ya debería estar listo gracias
    // al await en entry-producto.js). Si está vacío, hacer fallback async.
    const cacheActual = obtenerProductos();

    if (cacheActual.length > 0) {
        // Camino feliz: caché disponible de inmediato
        _renderConProductos(id, cacheActual, contenedor);
    } else {
        // Fallback: caché vacío (llamada directa sin prefetch). Mostrar
        // skeleton y esperar carga asíncrona.
        _mostrarSkeletonDetalle(contenedor);
        ensureProductosLoaded()
            .then(productos => _renderConProductos(id, productos, contenedor))
            .catch(() => {
                // Supabase no disponible: intentar con lo que haya en caché
                const fallback = obtenerProductos();
                _renderConProductos(id, fallback, contenedor);
            });
    }
}

// ── Render con productos ya disponibles ────────────────────────────────────────
function _renderConProductos(id, productos, contenedor) {
    const producto = Number.isFinite(id)
        ? productos.find(p => Number(p.id) === id)
        : null;

    if (!producto) {
        renderNoEncontrado(contenedor);
        const breadcrumb = document.getElementById('breadcrumb-nombre');
        if (breadcrumb) breadcrumb.textContent = 'Producto no encontrado';
        return;
    }

    // Breadcrumb + meta
    const breadcrumbNombre = document.getElementById('breadcrumb-nombre');
    if (breadcrumbNombre) breadcrumbNombre.textContent = producto.nombre;

    document.title = `${producto.nombre} | Maye Mundo Belleza`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && producto.descripcion) {
        metaDesc.setAttribute('content', producto.descripcion.slice(0, 155));
    }

    renderDetalle(contenedor, producto);
    renderRelacionados(producto, productos);
    conectarEventos(producto);
}

// ── Skeleton de carga (mientras espera Supabase en el fallback) ────────────────
function _mostrarSkeletonDetalle(contenedor) {
    const intern = contenedor.querySelector('.contenedor');
    if (!intern) return;
    intern.innerHTML = `
        <div class="producto-loading" aria-busy="true" aria-label="Cargando producto…">
            <div class="skeleton producto-loading__imagen" style="height:500px;border-radius:var(--radio-lg)"></div>
            <div class="producto-loading__info">
                <div class="skeleton" style="height:24px;width:130px;margin-bottom:14px;border-radius:50px"></div>
                <div class="skeleton" style="height:38px;width:90%;margin-bottom:18px"></div>
                <div class="skeleton" style="height:20px;width:100%;margin-bottom:8px"></div>
                <div class="skeleton" style="height:20px;width:95%;margin-bottom:8px"></div>
                <div class="skeleton" style="height:20px;width:80%;margin-bottom:30px"></div>
                <div class="skeleton" style="height:52px;width:100%;border-radius:var(--radio-md)"></div>
            </div>
        </div>`;
}

// ── RENDER: DETALLE COMPLETO ───────────────────────────────────────────────────
function renderDetalle(contenedor, p) {
    const contenedorInterno = contenedor.querySelector('.contenedor');
    if (!contenedorInterno) return;

    const agotado       = p.stock === 0 || p.etiqueta === 'agotado';
    const pocasUnidades = !agotado && p.stock > 0 && p.stock <= 5;
    const etiqData      = p.etiqueta && ETIQUETAS[p.etiqueta];

    // Disponibilidad
    let disponibilidadHTML;
    if (agotado) {
        disponibilidadHTML = `<span class="producto-disponibilidad agotado"><i class="ri-close-circle-fill"></i> Agotado</span>`;
    } else if (pocasUnidades) {
        disponibilidadHTML = `<span class="producto-disponibilidad pocas-unidades"><i class="ri-fire-fill"></i> ¡Últimas ${p.stock} unidades!</span>`;
    } else {
        disponibilidadHTML = `<span class="producto-disponibilidad disponible"><i class="ri-checkbox-circle-fill"></i> Disponible</span>`;
    }

    // Precios + ahorro
    const precioActual = `<span class="producto-precio__actual">${formatearPrecio(p.precio)}</span>`;
    let precioAnterior = '';
    let ahorro = '';
    if (p.precioAnterior && p.precioAnterior > p.precio) {
        const dcto = Math.round((1 - p.precio / p.precioAnterior) * 100);
        precioAnterior = `<span class="producto-precio__anterior">${formatearPrecio(p.precioAnterior)}</span>`;
        if (dcto > 0) ahorro = `<span class="producto-precio__ahorro">Ahorra ${dcto}%</span>`;
    }

    // Galería
    const imagenes    = Array.isArray(p.imagenes) && p.imagenes.length > 0 ? p.imagenes : [p.imagen];
    const principalSrc = imagenes[0] || p.imagen;
    const miniaturas   = imagenes.map((src, i) => `
        <button type="button"
                class="producto-galeria__miniatura${i === 0 ? ' activa' : ''}"
                data-img-index="${i}"
                aria-label="Ver imagen ${i + 1}">
            <img src="${src}" alt="${p.nombre} — imagen ${i + 1}" loading="lazy">
        </button>`).join('');

    const etiqSuperior = etiqData
        ? `<span style="display:inline-block;margin-bottom:10px" class="etiqueta-producto ${etiqData.clase}">${etiqData.texto}</span>`
        : '';

    // CTAs
    const btnAgregar = agotado
        ? `<button type="button" class="btn-accion btn-accion--primario" disabled aria-disabled="true">
               <i class="ri-close-circle-line"></i> Producto agotado
           </button>`
        : `<button type="button" class="btn-accion btn-accion--primario" id="btn-agregar-carrito"
               aria-label="Agregar ${p.nombre.replace(/"/g, '')} al carrito">
               <i class="ri-shopping-bag-3-line"></i> Agregar al carrito
           </button>`;

    const waMsg = p.whatsapp || encodeURIComponent(`Hola! Quiero comprar el producto: ${p.nombre} (referencia ${p.sku || p.id})`);
    const btnWhatsapp = `
        <a href="${waLink(waMsg)}"
           class="btn-accion btn-accion--whatsapp"
           target="_blank" rel="noopener noreferrer"
           id="btn-comprar-whatsapp">
            <i class="ri-whatsapp-line"></i> Comprar por WhatsApp
        </a>`;

    const stockHTML = p.stock > 0
        ? `<p class="producto-info__stock"><i class="ri-inbox-archive-line"></i> ${p.stock} unidades en stock</p>`
        : '';

    const marcaHTML = p.marca
        ? `<div class="producto-info__marca"><i class="ri-award-line"></i> Marca: <strong>${p.marca}</strong></div>`
        : '';

    contenedorInterno.innerHTML = `
        <div class="producto-detalle">

            <div class="producto-galeria">
                <div class="producto-galeria__principal">
                    <img id="img-principal"
                         src="${principalSrc}"
                         alt="${p.nombre}"
                         width="600" height="600"
                         onerror="this.src='https://placehold.co/600x600/FAF7F2/2A8C64?text=Maye'">
                </div>
                ${imagenes.length > 1
                    ? `<div class="producto-galeria__miniatura-wrap">${miniaturas}</div>`
                    : ''}
            </div>

            <div class="producto-info">

                <div class="producto-info__fila-superior">
                    <span class="categoria-tag">${categoriaLabel(p.categoria)}</span>
                    ${disponibilidadHTML}
                </div>

                ${etiqSuperior}

                <h1 class="producto-info__nombre">${p.nombre}</h1>

                ${marcaHTML}

                <div class="producto-precio">
                    ${precioActual}
                    ${precioAnterior}
                    ${ahorro}
                </div>

                <div class="producto-acciones">
                    ${btnAgregar}
                    ${btnWhatsapp}
                </div>

                ${stockHTML}

                <div class="producto-descripcion">
                    <h3><i class="ri-file-text-line" style="color:var(--verde-principal);margin-right:6px"></i> Descripción</h3>
                    <p>${p.descripcion || 'Sin descripción disponible.'}</p>
                </div>

                ${renderTabs(p)}

            </div>
        </div>`;
}

// ── TABS ───────────────────────────────────────────────────────────────────────
function renderTabs(p) {
    const hayAlgunTab = (p.beneficios?.length > 0)
                     || (p.modoUso?.length > 0)
                     || (p.ingredientes?.length > 0);
    if (!hayAlgunTab) return '';

    const beneficiosHTML = p.beneficios?.length > 0
        ? `<ul>${p.beneficios.map(b => `<li>${b}</li>`).join('')}</ul>`
        : `<p class="tab-panel__vacio">Información pendiente de publicación.</p>`;

    const modoUsoHTML = p.modoUso?.length > 0
        ? `<ol>${p.modoUso.map(s => `<li>${s}</li>`).join('')}</ol>`
        : `<p class="tab-panel__vacio">Aún no hemos publicado el modo de uso. Consulta con nosotros.</p>`;

    const ingredientesHTML = p.ingredientes?.length > 0
        ? `<ul>${p.ingredientes.map(ing => `<li>${ing}</li>`).join('')}</ul>`
        : `<p class="tab-panel__vacio">Consulta por WhatsApp si necesitas la lista de ingredientes.</p>`;

    const bActivo = p.beneficios?.length > 0   ? ' activo' : '';
    const mActivo = !bActivo && p.modoUso?.length > 0 ? ' activo' : '';
    const iActivo = !bActivo && !mActivo       ? ' activo' : '';

    return `
    <div class="producto-tabs" role="tablist">
        <h3>Más información</h3>
        <div class="tabs-lista">
            <button type="button" class="tab-btn${bActivo}" data-tab="beneficios"
                    role="tab" aria-selected="${bActivo ? 'true' : 'false'}">
                <i class="ri-heart-pulse-line"></i> Beneficios
            </button>
            <button type="button" class="tab-btn${mActivo}" data-tab="modo-uso"
                    role="tab" aria-selected="${mActivo ? 'true' : 'false'}">
                <i class="ri-list-check-2"></i> Modo de uso
            </button>
            <button type="button" class="tab-btn${iActivo}" data-tab="ingredientes"
                    role="tab" aria-selected="${iActivo ? 'true' : 'false'}">
                <i class="ri-flask-line"></i> Ingredientes
            </button>
        </div>
        <div class="tab-panel tab-panel--beneficios" data-panel="beneficios"
             role="tabpanel" ${bActivo ? '' : 'hidden'}>${beneficiosHTML}</div>
        <div class="tab-panel tab-panel--modo-uso" data-panel="modo-uso"
             role="tabpanel" ${mActivo ? '' : 'hidden'}>${modoUsoHTML}</div>
        <div class="tab-panel tab-panel--ingredientes" data-panel="ingredientes"
             role="tabpanel" ${iActivo ? '' : 'hidden'}>${ingredientesHTML}</div>
    </div>`;
}

// ── RELACIONADOS ───────────────────────────────────────────────────────────────
function renderRelacionados(producto, todos) {
    const relacionados = todos
        .filter(p => p.id !== producto.id && p.categoria === producto.categoria && p.visible)
        .slice(0, 4);
    if (relacionados.length === 0) return;

    const seccion = document.getElementById('relacionados');
    const grilla  = document.getElementById('grilla-relacionados');
    if (!seccion || !grilla) return;

    seccion.hidden = false;

    grilla.innerHTML = relacionados.map((rp, i) => {
        const agotado  = rp.stock === 0 || rp.etiqueta === 'agotado';
        const etiqData = rp.etiqueta && ETIQUETAS[rp.etiqueta];
        const precioHTML = rp.precioAnterior
            ? `<div class="precio-wrapper">
                   <span class="precio-producto">${formatearPrecio(rp.precio)}</span>
                   <span class="precio-anterior">${formatearPrecio(rp.precioAnterior)}</span>
               </div>`
            : `<div class="precio-wrapper">
                   <span class="precio-producto">${formatearPrecio(rp.precio)}</span>
               </div>`;
        const etiqHTML = etiqData
            ? `<span class="etiqueta-producto ${etiqData.clase}">${etiqData.texto}</span>`
            : '';
        const detalleURL = `/paginas/producto.html?id=${rp.id}`;

        return `
        <article class="tarjeta-producto${agotado ? ' agotada' : ''}" data-id="${rp.id}"
                 style="animation:fadeInUp 0.5s ease-out ${i * 0.07}s both">
            <a href="${detalleURL}" class="tarjeta-producto__enlace">
                <div class="imagen-producto-wrapper">
                    <img src="${rp.imagen}" alt="${rp.nombre}"
                         class="imagen-producto" loading="lazy" width="400" height="400"
                         onerror="this.src='https://placehold.co/400x400/FAF7F2/2A8C64?text=Maye'">
                    ${etiqHTML}
                    ${agotado ? '<div class="overlay-agotado"><span>Agotado</span></div>' : ''}
                </div>
            </a>
            <div class="info-producto">
                <span class="categoria-tag">${categoriaLabel(rp.categoria)}</span>
                <h3 class="nombre-producto"><a href="${detalleURL}">${rp.nombre}</a></h3>
                ${precioHTML}
                <button class="btn-comprar-tarjeta"
                        data-destacado-id="${rp.id}"
                        data-destacado-nombre="${rp.nombre.replace(/"/g, '&quot;')}"
                        data-destacado-precio="${rp.precio}"
                        data-destacado-imagen="${rp.imagen}"
                        ${agotado ? 'disabled aria-disabled="true"' : ''}
                        aria-label="Agregar ${rp.nombre.replace(/"/g, '')} al carrito">
                    <span>${agotado
                        ? '<i class="ri-close-circle-line"></i> Agotado'
                        : '<i class="ri-shopping-bag-3-line"></i> Agregar al carrito'}</span>
                </button>
            </div>
        </article>`;
    }).join('');
}

// ── EVENTOS ────────────────────────────────────────────────────────────────────
function conectarEventos(producto) {
    // Galería: miniaturas → imagen principal
    const principal  = document.getElementById('img-principal');
    const miniaturas = document.querySelectorAll('[data-img-index]');
    miniaturas.forEach(mini => {
        mini.addEventListener('click', () => {
            const index   = Number(mini.dataset.imgIndex);
            const imagenes = Array.isArray(producto.imagenes) && producto.imagenes.length > 0
                ? producto.imagenes
                : [producto.imagen];
            if (principal && imagenes[index]) principal.src = imagenes[index];
            miniaturas.forEach(m => m.classList.toggle('activa', m === mini));
        });
    });

    // Tabs
    const tabBtns   = document.querySelectorAll('[data-tab]');
    const tabPanels = document.querySelectorAll('[data-panel]');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabBtns.forEach(b => {
                const activo = b === btn;
                b.classList.toggle('activo', activo);
                b.setAttribute('aria-selected', String(activo));
            });
            tabPanels.forEach(panel => {
                panel.hidden = panel.dataset.panel !== tabId;
            });
        });
    });

    // Botón agregar al carrito
    const btnCarrito = document.getElementById('btn-agregar-carrito');
    if (btnCarrito) {
        btnCarrito.addEventListener('click', () => {
            agregarItem({
                id:     producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                imagen: producto.imagen,
            });
            feedbackBoton(btnCarrito);
        });
    }

    // Botones carrito de relacionados
    document.querySelectorAll('#grilla-relacionados .btn-comprar-tarjeta[data-destacado-id]')
        .forEach(btn => {
            if (btn.disabled) return;
            btn.addEventListener('click', e => {
                e.preventDefault();
                agregarItem({
                    id:     Number(btn.dataset.destacadoId),
                    nombre: btn.dataset.destacadoNombre,
                    precio: Number(btn.dataset.destacadoPrecio),
                    imagen: btn.dataset.destacadoImagen,
                });
                feedbackBoton(btn);
            });
        });
}

function feedbackBoton(btn) {
    if (btn.disabled) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="ri-check-line"></i> ¡Agregado!';
    btn.classList.add('btn-comprar-tarjeta--agregado');
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('btn-comprar-tarjeta--agregado');
        btn.disabled = false;
    }, 1600);
}

// ── ESTADO NO ENCONTRADO ───────────────────────────────────────────────────────
function renderNoEncontrado(contenedor) {
    const intern = contenedor.querySelector('.contenedor');
    if (!intern) return;
    intern.innerHTML = `
        <div class="producto-no-encontrado">
            <div class="producto-no-encontrado__icono"><i class="ri-emotion-sad-line"></i></div>
            <h2 class="producto-no-encontrado__titulo">Producto no encontrado</h2>
            <p class="producto-no-encontrado__texto">
                El producto que buscas no existe, fue retirado del catálogo o
                el enlace es incorrecto. Explora todo nuestro catálogo o contáctanos.
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">
                <a href="/paginas/productos.html" class="btn btn-primario">
                    <i class="ri-store-2-line"></i> Ver todo el catálogo
                </a>
                <a href="#" data-cta-whatsapp
                   data-wa-mensaje="Hola!%20No%20pude%20encontrar%20un%20producto%2C%20me%20puedes%20ayudar%3F"
                   class="btn btn-secundario--verde"
                   style="border:2px solid var(--verde-principal);color:var(--verde-principal);background:transparent;"
                   target="_blank" rel="noopener noreferrer">
                    <i class="ri-whatsapp-line"></i> Consultar por WhatsApp
                </a>
            </div>
        </div>`;
}
