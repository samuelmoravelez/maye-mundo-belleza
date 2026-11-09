// js/pages/carrito.js
// ─────────────────────────────────────────────────────────────────────────────
// Lógica de interacción para la página de Carrito estilo Mercado Libre
// Conexión directa a Supabase (Prohibido el uso de LocalStorage):
// - Tablas: carts, cart_items, products, product_images, coupons
// - Consultas con Joins relacionales
// - Actualizaciones y eliminaciones directas en Supabase
// - Barra dinámica de envío gratis
// - Cupones de descuento interactivos
// - Redirección a checkout.html
// ─────────────────────────────────────────────────────────────────────────────

import { supabase }                from '../../src/js/services/supabaseClient.js';
import { formatearPrecio }         from '../data/productos.data.js';
import { RUTAS, SHIPPING_COST, ENVIO_GRATIS_MINIMO } from '../utils/constants.js';
import { guardarSnapshotCheckout } from '../utils/orderService.js';

// Umbral de compra para Envío Gratis (COP) — importado desde constants.js

// Estado en memoria de la página del carrito
let _cartItems = [];
let _userId = null;
let _cartId = null;
let _cuponAplicado = null;
let _estaCargando = false;

/**
 * Inicializador principal de la página Carrito.
 * Garantiza que el skeleton SIEMPRE desaparece, incluso ante errores
 * inesperados o timeouts de red.
 */
export async function iniciarCarrito() {
    // ── Timeout de seguridad: si a los 10 s el skeleton sigue visible,
    //    forzar el estado de error para que nunca quede colgado. ──────────
    const _timeoutGuard = setTimeout(() => {
        const skeletonAun = document.getElementById('carrito-loading');
        if (skeletonAun && !skeletonAun.hidden) {
            console.warn('[Carrito] Timeout de seguridad activado — la carga tardó demasiado.');
            mostrarEstado('vacio');
        }
    }, 10_000);

    try {
        configurarEventosUI();
        await cargarCarritoDesdeSupabase();
    } catch (err) {
        // Captura cualquier excepción no manejada dentro de la inicialización
        console.error('[Carrito] Error fatal en iniciarCarrito:', err);
        mostrarEstado('vacio');
    } finally {
        clearTimeout(_timeoutGuard);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CARGA INICIAL DESDE SUPABASE (JOINS RELACIONALES)
// ─────────────────────────────────────────────────────────────────────────────
async function cargarCarritoDesdeSupabase() {
    mostrarEstado('loading');

    try {
        // A. Obtener sesión activa de Supabase Auth
        let session;
        try {
            const { data, error: sessionErr } = await supabase.auth.getSession();
            if (sessionErr) {
                console.error('[Carrito] Error al obtener sesión:', sessionErr.message);
                mostrarEstado('no-auth');
                return;
            }
            session = data?.session;
        } catch (sessionEx) {
            console.error('[Carrito] Excepción al obtener sesión Supabase:', sessionEx);
            mostrarEstado('no-auth');
            return;
        }

        if (!session?.user) {
            console.warn('[Carrito] Sin sesión activa — mostrando pantalla de login.');
            mostrarEstado('no-auth');
            return;
        }

        _userId = session.user.id;

        // B. Consultar o garantizar fila en la tabla carts
        let cart;
        try {
            const { data: cartData, error: cartErr } = await supabase
                .from('carts')
                .select('id')
                .eq('user_id', _userId)
                .maybeSingle();

            if (cartErr) {
                console.error('[Carrito] RLS / Error al consultar carts:', cartErr.message, '| code:', cartErr.code);
                // Continuar: intentar crear el carrito de todas formas
            }
            cart = cartData;
        } catch (cartEx) {
            console.error('[Carrito] Excepción al consultar carts:', cartEx);
        }

        if (!cart?.id) {
            try {
                const { data: newCart, error: createErr } = await supabase
                    .from('carts')
                    .insert({ user_id: _userId })
                    .select('id')
                    .single();

                if (createErr) {
                    console.error('[Carrito] RLS / Error al crear cart:', createErr.message, '| code:', createErr.code);
                    // Sin cart_id no podemos continuar → mostrar vacío
                    mostrarEstado('vacio');
                    actualizarBadgeHeader(0);
                    return;
                }
                cart = newCart;
            } catch (createEx) {
                console.error('[Carrito] Excepción al crear cart:', createEx);
                mostrarEstado('vacio');
                actualizarBadgeHeader(0);
                return;
            }
        }

        _cartId = cart.id;

        // C. Consulta relacional a cart_items uniendo products y product_images
        let rawItems = [];
        try {
            const { data: itemsData, error: itemsErr } = await supabase
                .from('cart_items')
                .select(`
                    id,
                    quantity,
                    product_id,
                    products (
                        id,
                        name,
                        price,
                        compare_at_price,
                        stock_quantity,
                        is_visible,
                        product_images (
                            url,
                            sort_order
                        )
                    )
                `)
                .eq('cart_id', _cartId)
                .order('id', { ascending: true });

            if (itemsErr) {
                console.error('[Carrito] RLS / Error al traer cart_items:', itemsErr.message, '| code:', itemsErr.code);
                mostrarEstado('vacio');
                actualizarBadgeHeader(0);
                return;
            }
            rawItems = itemsData ?? [];
        } catch (itemsEx) {
            console.error('[Carrito] Excepción al traer cart_items:', itemsEx);
            mostrarEstado('vacio');
            actualizarBadgeHeader(0);
            return;
        }

        // D. Mapear datos extrayendo imagen principal (sort_order = 0)
        _cartItems = rawItems.map(row => {
            const prod = row.products;
            const images = (prod?.product_images || []).slice()
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            
            // Prioridad a sort_order === 0, o fallback a la primera imagen
            const imgPrincipal = images.find(img => img.sort_order === 0)?.url
                || images[0]?.url
                || 'https://res.cloudinary.com/ocnnxclz/image/upload/v1784219028/333_mvofgw.png';

            return {
                id: row.id, // ID del registro en cart_items
                productId: prod?.id || row.product_id,
                name: prod?.name || 'Producto Maye Mundo Belleza',
                price: Number(prod?.price || 0),
                compareAtPrice: prod?.compare_at_price ? Number(prod.compare_at_price) : null,
                stock: prod?.stock_quantity ?? 0,
                quantity: Math.max(1, row.quantity || 1),
                image: imgPrincipal,
                selected: true, // Checkbox activo por defecto estilo Mercado Libre
            };
        });

        // E. Si el carrito no tiene ítems, mostrar estado vacío
        if (_cartItems.length === 0) {
            mostrarEstado('vacio');
            actualizarBadgeHeader(0);
            return;
        }

        // F. Renderizar vista de productos
        mostrarEstado('grid');
        renderizarListaProductos();
        recalcularTotales();

    } catch (err) {
        // Captura de último recurso: cualquier excepción no manejada internamente
        console.error('[Carrito] Excepción general no capturada:', err);
        mostrarEstado('vacio');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RENDERIZADO DE FILAS DE PRODUCTO (ESTILO MERCADO LIBRE)
// ─────────────────────────────────────────────────────────────────────────────
function renderizarListaProductos() {
    const contenedor = document.getElementById('carrito-items-contenedor');
    if (!contenedor) return;

    if (_cartItems.length === 0) {
        mostrarEstado('vacio');
        return;
    }

    contenedor.innerHTML = _cartItems.map(item => {
        const subtotalFila = item.price * item.quantity;
        const tieneDescuento = item.compareAtPrice && item.compareAtPrice > item.price;
        const subtotalOriginal = tieneDescuento ? item.compareAtPrice * item.quantity : null;
        const stockAgotado = item.stock <= 0;
        const stockBajo = item.stock > 0 && item.stock <= 5;

        return `
            <article class="ml-cart-item ${!item.selected ? 'ml-cart-item--deseleccionado' : ''}" data-cart-item-id="${item.id}">
                <!-- Checkbox Individual -->
                <div class="ml-cart-item__check-wrap">
                    <input type="checkbox"
                           class="checkbox-custom item-check"
                           id="check-item-${item.id}"
                           data-item-id="${item.id}"
                           ${item.selected ? 'checked' : ''}
                           aria-label="Seleccionar ${escaparHTML(item.name)}">
                </div>

                <!-- Imagen Producto (sort_order = 0) -->
                <a href="/paginas/producto.html?id=${item.productId}" class="ml-cart-item__img-link" title="Ver detalle de ${escaparHTML(item.name)}">
                    <img src="${item.image}" alt="${escaparHTML(item.name)}" class="ml-cart-item__img" loading="lazy"
                         onerror="this.src='https://res.cloudinary.com/ocnnxclz/image/upload/v1784219028/333_mvofgw.png'">
                </a>

                <!-- Información del producto -->
                <div class="ml-cart-item__info">
                    <a href="/paginas/producto.html?id=${item.productId}" class="ml-cart-item__title">
                        ${escaparHTML(item.name)}
                    </a>

                    <div class="ml-cart-item__stock-badge ${stockBajo ? 'ml-cart-item__stock-badge--low' : ''}">
                        ${stockAgotado 
                            ? '<i class="ri-close-circle-line"></i> Agotado' 
                            : `<i class="ri-check-line"></i> ${stockBajo ? `¡Solo ${item.stock} disponibles!` : `Stock disponible: ${item.stock} un.`}`
                        }
                    </div>

                    <div class="ml-cart-item__actions">
                        <button type="button" class="btn-action-item btn-action-item--delete" data-action="delete" data-item-id="${item.id}">
                            <i class="ri-delete-bin-line"></i> Eliminar
                        </button>
                        <span class="action-divider">|</span>
                        <a href="/paginas/producto.html?id=${item.productId}" class="btn-action-item">
                            <i class="ri-eye-line"></i> Ver producto
                        </a>
                    </div>
                </div>

                <!-- Controles: Selector de cantidad y precio -->
                <div class="ml-cart-item__controls">
                    <div class="ml-qty-selector" aria-label="Cantidad">
                        <button type="button"
                                class="btn-qty btn-qty--minus"
                                data-action="minus"
                                data-item-id="${item.id}"
                                ${item.quantity <= 1 ? 'disabled' : ''}
                                aria-label="Disminuir una unidad">
                            <i class="ri-subtract-line"></i>
                        </button>
                        <span class="qty-display" id="qty-val-${item.id}">${item.quantity}</span>
                        <button type="button"
                                class="btn-qty btn-qty--plus"
                                data-action="plus"
                                data-item-id="${item.id}"
                                ${item.quantity >= item.stock ? 'disabled' : ''}
                                aria-label="Aumentar una unidad">
                            <i class="ri-add-line"></i>
                        </button>
                    </div>

                    <div class="ml-cart-item__price-block">
                        ${subtotalOriginal ? `<span class="price-original">${formatearPrecio(subtotalOriginal)}</span>` : ''}
                        <span class="price-current" id="subtotal-val-${item.id}">${formatearPrecio(subtotalFila)}</span>
                        ${item.quantity > 1 ? `<span class="price-unit">${formatearPrecio(item.price)} c/u</span>` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('');

    actualizarEstadoCheckboxGlobal();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ACTUALIZACIÓN DE CANTIDADES (+) / (-) EN SUPABASE
// ─────────────────────────────────────────────────────────────────────────────
async function modificarCantidad(cartItemId, delta) {
    if (_estaCargando) return;
    const item = _cartItems.find(i => i.id === cartItemId);
    if (!item) return;

    const nuevaCantidad = item.quantity + delta;

    // Si intenta bajar de 1, confirmar eliminación
    if (nuevaCantidad < 1) {
        await eliminarItem(cartItemId);
        return;
    }

    // Validar límite contra stock
    if (nuevaCantidad > item.stock) {
        mostrarNotificacionToast(`Solo hay ${item.stock} unidades disponibles de este producto.`);
        return;
    }

    _estaCargando = true;
    const qtySpan = document.getElementById(`qty-val-${cartItemId}`);
    if (qtySpan) qtySpan.textContent = '...';

    try {
        // UPDATE directo en Supabase
        const { error } = await supabase
            .from('cart_items')
            .update({ quantity: nuevaCantidad })
            .eq('id', cartItemId);

        if (error) {
            console.error('[Carrito] Error al actualizar cantidad:', error.message);
            mostrarNotificacionToast('No se pudo actualizar la cantidad.');
            if (qtySpan) qtySpan.textContent = item.quantity;
            return;
        }

        // Actualizar estado en memoria
        item.quantity = nuevaCantidad;

        // Actualizar DOM del ítem
        if (qtySpan) qtySpan.textContent = nuevaCantidad;

        const subtotalEl = document.getElementById(`subtotal-val-${cartItemId}`);
        if (subtotalEl) subtotalEl.textContent = formatearPrecio(item.price * nuevaCantidad);

        // Actualizar botones de más / menos
        const filaEl = document.querySelector(`.ml-cart-item[data-cart-item-id="${cartItemId}"]`);
        if (filaEl) {
            const btnMinus = filaEl.querySelector('.btn-qty--minus');
            const btnPlus  = filaEl.querySelector('.btn-qty--plus');
            if (btnMinus) btnMinus.disabled = nuevaCantidad <= 1;
            if (btnPlus)  btnPlus.disabled  = nuevaCantidad >= item.stock;
        }

        recalcularTotales();

    } catch (err) {
        console.error('[Carrito] Error inesperado en cantidad:', err);
    } finally {
        _estaCargando = false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ELIMINACIÓN DE ÍTEM EN SUPABASE (DELETE)
// ─────────────────────────────────────────────────────────────────────────────
async function eliminarItem(cartItemId) {
    if (_estaCargando) return;
    const item = _cartItems.find(i => i.id === cartItemId);
    if (!item) return;

    _estaCargando = true;
    const filaEl = document.querySelector(`.ml-cart-item[data-cart-item-id="${cartItemId}"]`);
    if (filaEl) {
        filaEl.style.opacity = '0.4';
        filaEl.style.pointerEvents = 'none';
    }

    try {
        // DELETE directo en Supabase
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', cartItemId);

        if (error) {
            console.error('[Carrito] Error al eliminar cart_item:', error.message);
            mostrarNotificacionToast('Error al eliminar el producto.');
            if (filaEl) {
                filaEl.style.opacity = '1';
                filaEl.style.pointerEvents = 'auto';
            }
            return;
        }

        // Quitar de la lista en memoria
        _cartItems = _cartItems.filter(i => i.id !== cartItemId);

        // Remover del DOM con transición suave
        if (filaEl) {
            filaEl.remove();
        }

        if (_cartItems.length === 0) {
            mostrarEstado('vacio');
        }

        recalcularTotales();
        actualizarEstadoCheckboxGlobal();

    } catch (err) {
        console.error('[Carrito] Excepción al eliminar ítem:', err);
    } finally {
        _estaCargando = false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ELIMINAR TODOS LOS SELECCIONADOS
// ─────────────────────────────────────────────────────────────────────────────
async function eliminarSeleccionados() {
    const seleccionados = _cartItems.filter(i => i.selected);
    if (seleccionados.length === 0) return;

    if (!confirm(`¿Deseas eliminar los ${seleccionados.length} productos seleccionados del carrito?`)) {
        return;
    }

    const idsAEliminar = seleccionados.map(i => i.id);

    try {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .in('id', idsAEliminar);

        if (error) {
            console.error('[Carrito] Error al eliminar seleccionados:', error.message);
            mostrarNotificacionToast('Error al eliminar productos seleccionados.');
            return;
        }

        _cartItems = _cartItems.filter(i => !i.selected);

        if (_cartItems.length === 0) {
            mostrarEstado('vacio');
        } else {
            renderizarListaProductos();
        }

        recalcularTotales();

    } catch (err) {
        console.error('[Carrito] Excepción al eliminar varios:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CÁLCULO DE TOTALES Y BARRA DE ENVÍO GRATIS
// ─────────────────────────────────────────────────────────────────────────────
function recalcularTotales() {
    const seleccionados = _cartItems.filter(i => i.selected);
    const subtotal = seleccionados.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cantidadItems = seleccionados.reduce((sum, item) => sum + item.quantity, 0);

    // Barra de Envío Gratis
    actualizarBarraEnvioGratis(subtotal);

    // Costo de envío: Gratis si subtotal >= ENVIO_GRATIS_MINIMO, de lo contrario SHIPPING_COST
    let costoEnvio = 0;
    if (subtotal > 0) {
        costoEnvio = subtotal >= ENVIO_GRATIS_MINIMO ? 0 : SHIPPING_COST;
    }

    // Descuento por cupón aplicado
    let descuento = 0;
    if (_cuponAplicado && subtotal > 0) {
        if (_cuponAplicado.type === 'porcentaje' || _cuponAplicado.type === 'percentage') {
            descuento = Math.round(subtotal * (_cuponAplicado.value / 100));
        } else {
            descuento = Math.min(_cuponAplicado.value, subtotal);
        }
    }

    const total = Math.max(0, subtotal + costoEnvio - descuento);

    // Actualizar elementos en el DOM
    const elSubtotal = document.getElementById('resumen-subtotal');
    const elEnvio    = document.getElementById('resumen-envio');
    const elTotal    = document.getElementById('resumen-total');
    const elCantProd = document.getElementById('resumen-label-cant');
    const elCantTop  = document.getElementById('txt-cant-seleccionados');
    const elBadge    = document.getElementById('carrito-contador-badge');

    if (elSubtotal) elSubtotal.textContent = formatearPrecio(subtotal);
    if (elTotal)    elTotal.textContent    = formatearPrecio(total);
    if (elCantProd) elCantProd.textContent = `Productos (${cantidadItems})`;
    if (elCantTop)  elCantTop.textContent  = `${cantidadItems}`;
    if (elBadge)    elBadge.textContent    = `${_cartItems.length} producto${_cartItems.length !== 1 ? 's' : ''}`;

    if (elEnvio) {
        if (subtotal === 0) {
            elEnvio.textContent = formatearPrecio(SHIPPING_COST);
            elEnvio.className = 'resumen-envio-valor';
        } else if (costoEnvio === 0) {
            elEnvio.textContent = 'Gratis';
            elEnvio.className = 'resumen-envio-valor resumen-envio-valor--gratis';
        } else {
            elEnvio.textContent = formatearPrecio(costoEnvio);
            elEnvio.className = 'resumen-envio-valor';
        }
    }

    // Fila de descuento en resumen
    const filaDesc = document.getElementById('resumen-fila-descuento');
    const txtDesc  = document.getElementById('resumen-descuento');
    const tagDesc  = document.getElementById('resumen-cupon-codigo');

    if (filaDesc && txtDesc) {
        if (descuento > 0 && _cuponAplicado) {
            filaDesc.removeAttribute('hidden');
            txtDesc.textContent = `-${formatearPrecio(descuento)}`;
            if (tagDesc) tagDesc.textContent = _cuponAplicado.code;
        } else {
            filaDesc.setAttribute('hidden', '');
        }
    }

    // Botón Continuar
    const btnContinuar = document.getElementById('btn-continuar-checkout');
    if (btnContinuar) {
        btnContinuar.disabled = seleccionados.length === 0;
    }

    actualizarBadgeHeader(_cartItems.length);
}

function actualizarBarraEnvioGratis(subtotal) {
    const card = document.getElementById('carrito-envio-gratis-card');
    const msg  = document.getElementById('envio-gratis-mensaje');
    const bar  = document.getElementById('envio-gratis-bar');
    const icon = document.getElementById('envio-gratis-icono');

    if (!card || !msg || !bar) return;

    if (subtotal >= ENVIO_GRATIS_MINIMO) {
        card.classList.add('carrito-envio-gratis-card--completado');
        msg.innerHTML = '¡Felicidades! Tienes <strong style="color:var(--verde-principal)">Envío Gratis</strong> en este pedido.';
        bar.style.width = '100%';
        if (icon) icon.className = 'ri-checkbox-circle-fill';
    } else {
        card.classList.remove('carrito-envio-gratis-card--completado');
        const falta = ENVIO_GRATIS_MINIMO - subtotal;
        const porcentaje = Math.min(100, Math.max(0, (subtotal / ENVIO_GRATIS_MINIMO) * 100));
        msg.innerHTML = `¡Agrega <strong>${formatearPrecio(falta)}</strong> más para tener <strong>Envío Gratis</strong>!`;
        bar.style.width = `${porcentaje}%`;
        if (icon) icon.className = 'ri-truck-line';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MÓDULO DE CUPONES DE DESCUENTO (TABLA COUPONS)
// ─────────────────────────────────────────────────────────────────────────────
async function validarYAplicarCupon() {
    const input   = document.getElementById('input-cupon-codigo');
    const errorEl = document.getElementById('cupon-error-msg');
    const btn     = document.getElementById('btn-aplicar-cupon');

    if (!input || !btn) return;
    const codigo = input.value.trim().toUpperCase();

    if (!codigo) {
        mostrarErrorCupon('Ingresa un código de cupón.');
        return;
    }

    const seleccionados = _cartItems.filter(i => i.selected);
    const subtotal = seleccionados.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (subtotal <= 0) {
        mostrarErrorCupon('Selecciona al menos un producto para aplicar el cupón.');
        return;
    }

    // Feedback de carga
    setBotonCargando(btn, true);
    mostrarErrorCupon('');

    try {
        // Consulta directa a la tabla coupons de Supabase
        const { data: cupon, error } = await supabase
            .from('coupons')
            .select('*')
            .ilike('code', codigo)
            .eq('is_active', true)
            .is('deleted_at', null)
            .maybeSingle();

        if (error || !cupon) {
            mostrarErrorCupon('El cupón no existe o no está activo.');
            return;
        }

        // Validar fecha de expiración
        if (cupon.expires_at && new Date(cupon.expires_at) < new Date()) {
            mostrarErrorCupon('Este cupón ha expirado.');
            return;
        }

        // Validar límite máximo de usos
        if (cupon.max_uses !== null && (cupon.current_uses ?? 0) >= cupon.max_uses) {
            mostrarErrorCupon('Este cupón ya alcanzó su límite máximo de usos.');
            return;
        }

        // Validar monto mínimo de compra
        const minCompra = Number(cupon.min_purchase || 0);
        if (subtotal < minCompra) {
            mostrarErrorCupon(`Este cupón requiere una compra mínima de ${formatearPrecio(minCompra)}.`);
            return;
        }

        // Calcular descuento
        const valorCupon = Number(cupon.value);
        let descuento = 0;
        const tipoCupon = cupon.type;

        if (tipoCupon === 'porcentaje' || tipoCupon === 'percentage') {
            descuento = Math.round(subtotal * (valorCupon / 100));
        } else {
            descuento = Math.min(valorCupon, subtotal);
        }

        // Guardar cupón activo en memoria
        _cuponAplicado = {
            id: cupon.id,
            code: cupon.code,
            type: tipoCupon,
            value: valorCupon,
            discount: descuento,
            description: cupon.description || '',
        };

        // Actualizar UI del cupón
        renderizarBadgeCuponAplicado();
        recalcularTotales();

    } catch (err) {
        console.error('[Carrito] Error al validar cupón:', err);
        mostrarErrorCupon('Error al verificar el cupón. Intenta nuevamente.');
    } finally {
        setBotonCargando(btn, false);
    }
}

function removerCupon() {
    _cuponAplicado = null;

    const wrapForm  = document.getElementById('cupon-form-wrap');
    const badgeEl   = document.getElementById('cupon-aplicado-badge');
    const input     = document.getElementById('input-cupon-codigo');

    if (badgeEl)  badgeEl.setAttribute('hidden', '');
    if (wrapForm) wrapForm.removeAttribute('hidden');
    if (input)    input.value = '';

    mostrarErrorCupon('');
    recalcularTotales();
}

function renderizarBadgeCuponAplicado() {
    const wrapForm = document.getElementById('cupon-form-wrap');
    const badgeEl  = document.getElementById('cupon-aplicado-badge');
    const codigoEl = document.getElementById('cupon-aplicado-codigo');
    const descEl   = document.getElementById('cupon-aplicado-desc');

    if (!badgeEl || !_cuponAplicado) return;

    if (wrapForm) wrapForm.setAttribute('hidden', '');
    if (codigoEl) codigoEl.textContent = `Cupón ${_cuponAplicado.code} aplicado`;
    if (descEl)   descEl.textContent   = _cuponAplicado.type === 'porcentaje'
        ? `${_cuponAplicado.value}% de descuento en tus productos seleccionados`
        : `${formatearPrecio(_cuponAplicado.value)} de descuento`;

    badgeEl.removeAttribute('hidden');
}

function mostrarErrorCupon(msg) {
    const errorEl = document.getElementById('cupon-error-msg');
    if (!errorEl) return;
    errorEl.textContent = msg;
    if (msg) errorEl.removeAttribute('hidden');
    else errorEl.setAttribute('hidden', '');
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. CONTINUAR AL CHECKOUT
// ─────────────────────────────────────────────────────────────────────────────
function continuarAlCheckout() {
    const seleccionados = _cartItems.filter(i => i.selected);

    if (seleccionados.length === 0) {
        mostrarNotificacionToast('Selecciona al menos un producto para continuar.');
        return;
    }

    const btn = document.getElementById('btn-continuar-checkout');
    setBotonCargando(btn, true);

    // Preparar el snapshot de los ítems seleccionados para el flujo de checkout
    const itemsSnapshot = seleccionados.map(i => ({
        id: i.productId,
        nombre: i.name,
        precio: i.price,
        imagen: i.image,
        cantidad: i.quantity,
    }));

    guardarSnapshotCheckout(itemsSnapshot);

    // Si hay cupón activo, adjuntar a query param o sessionStorage
    let urlDestino = RUTAS.CHECKOUT;
    if (_cuponAplicado?.code) {
        urlDestino += `?cupon=${encodeURIComponent(_cuponAplicado.code)}`;
    }

    setTimeout(() => {
        window.location.href = urlDestino;
    }, 300);
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. CONFIGURACIÓN DE EVENTOS DEL DOM
// ─────────────────────────────────────────────────────────────────────────────
function configurarEventosUI() {
    // A. Checkbox "Seleccionar todos"
    const checkTodos = document.getElementById('check-seleccionar-todos');
    if (checkTodos) {
        checkTodos.addEventListener('change', () => {
            const marcado = checkTodos.checked;
            _cartItems.forEach(i => i.selected = marcado);

            document.querySelectorAll('.item-check').forEach(chk => {
                chk.checked = marcado;
            });

            document.querySelectorAll('.ml-cart-item').forEach(card => {
                card.classList.toggle('ml-cart-item--deseleccionado', !marcado);
            });

            recalcularTotales();
        });
    }

    // B. Delegación de eventos en el contenedor de ítems (clicks en +, -, eliminar, checks)
    const contenedorItems = document.getElementById('carrito-items-contenedor');
    if (contenedorItems) {
        contenedorItems.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const accion = btn.dataset.action;
            const itemId = parseInt(btn.dataset.itemId, 10);

            if (accion === 'plus') {
                await modificarCantidad(itemId, 1);
            } else if (accion === 'minus') {
                await modificarCantidad(itemId, -1);
            } else if (accion === 'delete') {
                await eliminarItem(itemId);
            }
        });

        contenedorItems.addEventListener('change', (e) => {
            const chk = e.target.closest('.item-check');
            if (!chk) return;

            const itemId = parseInt(chk.dataset.itemId, 10);
            const item = _cartItems.find(i => i.id === itemId);
            if (item) {
                item.selected = chk.checked;
                const card = chk.closest('.ml-cart-item');
                if (card) card.classList.toggle('ml-cart-item--deseleccionado', !chk.checked);
            }

            actualizarEstadoCheckboxGlobal();
            recalcularTotales();
        });
    }

    // C. Botón "Eliminar seleccionados"
    const btnEliminarSel = document.getElementById('btn-eliminar-seleccionados');
    if (btnEliminarSel) {
        btnEliminarSel.addEventListener('click', eliminarSeleccionados);
    }

    // D. Acordeón de Cupones
    const btnToggleCupon = document.getElementById('btn-toggle-cupon');
    const desplegableCupon = document.getElementById('cupon-desplegable');

    if (btnToggleCupon && desplegableCupon) {
        btnToggleCupon.addEventListener('click', () => {
            const expandido = btnToggleCupon.getAttribute('aria-expanded') === 'true';
            btnToggleCupon.setAttribute('aria-expanded', !expandido);
            desplegableCupon.hidden = expandido;
            if (!expandido) {
                const input = document.getElementById('input-cupon-codigo');
                setTimeout(() => input?.focus(), 100);
            }
        });
    }

    // E. Aplicar / Remover cupón
    const btnAplicarCupon = document.getElementById('btn-aplicar-cupon');
    const inputCupon      = document.getElementById('input-cupon-codigo');
    const btnRemoverCupon = document.getElementById('btn-remover-cupon');

    if (btnAplicarCupon) {
        btnAplicarCupon.addEventListener('click', validarYAplicarCupon);
    }

    if (inputCupon) {
        inputCupon.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                validarYAplicarCupon();
            }
        });
    }

    if (btnRemoverCupon) {
        btnRemoverCupon.addEventListener('click', removerCupon);
    }

    // F. Botón "Continuar" hacia checkout
    const btnContinuar = document.getElementById('btn-continuar-checkout');
    if (btnContinuar) {
        btnContinuar.addEventListener('click', continuarAlCheckout);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────
function mostrarEstado(estado) {
    const elLoading = document.getElementById('carrito-loading');
    const elNoAuth  = document.getElementById('carrito-no-auth');
    const elVacio   = document.getElementById('carrito-vacio-full');
    const elGrid    = document.getElementById('carrito-grid');

    // Doble mecanismo: hidden (semántico) + display:none (garantía visual)
    // para que el skeleton desaparezca incluso si alguna regla CSS lo sobreescribe.
    function _ocultar(el) {
        if (!el) return;
        el.hidden = true;
        el.style.display = 'none';
    }
    function _mostrar(el) {
        if (!el) return;
        el.hidden = false;
        el.style.display = '';   // Restablecer al valor del CSS
    }

    _ocultar(elLoading);
    _ocultar(elNoAuth);
    _ocultar(elVacio);
    _ocultar(elGrid);

    switch (estado) {
        case 'loading': _mostrar(elLoading); break;
        case 'no-auth': _mostrar(elNoAuth);  break;
        case 'vacio':   _mostrar(elVacio);   break;
        case 'grid':    _mostrar(elGrid);    break;
        default:
            console.warn('[Carrito] mostrarEstado: estado desconocido →', estado);
    }
}

function actualizarEstadoCheckboxGlobal() {
    const checkTodos = document.getElementById('check-seleccionar-todos');
    if (!checkTodos || _cartItems.length === 0) return;

    const totalSel = _cartItems.filter(i => i.selected).length;
    checkTodos.checked = totalSel === _cartItems.length;
    checkTodos.indeterminate = totalSel > 0 && totalSel < _cartItems.length;

    const btnEliminarSel = document.getElementById('btn-eliminar-seleccionados');
    if (btnEliminarSel) {
        btnEliminarSel.style.display = totalSel > 0 ? 'inline-flex' : 'none';
    }
}

function actualizarBadgeHeader(cantidad) {
    document.querySelectorAll('.contador-carrito').forEach(badge => {
        badge.textContent = cantidad;
        badge.style.display = cantidad > 0 ? 'inline-flex' : 'none';
    });
}

function setBotonCargando(btn, cargando) {
    if (!btn) return;
    btn.disabled = cargando;
    const txt = btn.querySelector('.btn-txt');
    const ldr = btn.querySelector('.btn-ldr');
    if (txt) txt.style.display = cargando ? 'none' : 'inline-flex';
    if (ldr) ldr.style.display = cargando ? 'inline-flex' : 'none';
}

function mostrarNotificacionToast(msg) {
    // Alerta ligera temporal estilo toast
    let toast = document.getElementById('carrito-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'carrito-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: #1f2937;
            color: #ffffff;
            padding: 12px 24px;
            border-radius: 999px;
            font-size: 0.88rem;
            font-weight: 500;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            z-index: 99999;
            transition: opacity 0.3s ease, transform 0.3s ease;
            pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
    }, 3200);
}

function escaparHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
