// js/components/navActivo.js
// Responsabilidad: marcar con la clase `activo` el enlace del menú
// que corresponda a la página actual. Evita tener que duplicar el
// código de clase `activo` en cada HTML y permite que el partial
// header sea 100% idéntico en todas las páginas.

const MAPA_NAV = Object.freeze({
    '/index.html':              'home',
    '/':                        'home',
    '/paginas/productos.html':  'productos',
    '/paginas/producto.html':   'productos',
    '/paginas/contacto.html':   'contacto',
    '/paginas/legales.html':    null,
    '/admin.html':              null,
});

export function iniciarNavActivo() {
    const nav = document.getElementById('menu-principal');
    if (!nav) return;

    const path = window.location.pathname;
    const clave = MAPA_NAV[path];

    // 1) Limpiar cualquier activación previa
    nav.querySelectorAll('a').forEach(a => a.classList.remove('activo'));

    // 2) Marcar el correspondiente
    if (!clave) return;
    const el = nav.querySelector(`a[data-nav="${clave}"]`);
    if (el) el.classList.add('activo');
}
