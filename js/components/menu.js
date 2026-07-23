// js/components/menu.js
// Responsabilidad: menú de navegación hamburguesa.

export function iniciarMenu() {
    const btnMenu       = document.getElementById('btn-menu');
    const menuPrincipal = document.getElementById('menu-principal');

    if (!btnMenu || !menuPrincipal) return;

    btnMenu.addEventListener('click', () => {
        const estaAbierto = menuPrincipal.classList.toggle('abierto');
        btnMenu.classList.toggle('abierto', estaAbierto);
        btnMenu.setAttribute('aria-expanded', estaAbierto);
    });

    menuPrincipal.querySelectorAll('a').forEach(enlace => {
        enlace.addEventListener('click', () => {
            menuPrincipal.classList.remove('abierto');
            btnMenu.classList.remove('abierto');
            btnMenu.setAttribute('aria-expanded', 'false');
        });
    });
}
