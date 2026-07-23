// js/pages/faq.js
// Interactividad del acordeón FAQ — sin dependencias externas.

export function iniciarFAQ() {
    const items = document.querySelectorAll('.faq-item');
    if (!items.length) return;

    items.forEach(item => {
        const pregunta  = item.querySelector('.faq-pregunta');
        const respuesta = item.querySelector('.faq-respuesta');
        if (!pregunta || !respuesta) return;

        pregunta.addEventListener('click', () => {
            const estaAbierto = item.classList.contains('abierto');

            // Cerrar todos los demás
            items.forEach(otro => {
                otro.classList.remove('abierto');
                otro.querySelector('.faq-pregunta')?.setAttribute('aria-expanded', 'false');
            });

            // Abrir/cerrar el actual
            if (!estaAbierto) {
                item.classList.add('abierto');
                pregunta.setAttribute('aria-expanded', 'true');
            }
        });

        // Accesibilidad teclado
        pregunta.setAttribute('aria-expanded', 'false');
        respuesta.setAttribute('role', 'region');
    });
}
