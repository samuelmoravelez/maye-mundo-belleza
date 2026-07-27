// js/entries/entry-legales.js
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/legales.css';
import '../../css/auth.css';

import '../main.js';
import { iniciarAuthModal } from '../components/authModal.js';
import { inicializarAdmin } from '../utils/authService.js';

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
    iniciarAuthModal();

    // Resaltar link del sidebar al scrollear (IntersectionObserver básico)
    const secciones = document.querySelectorAll('.legal-seccion');
    const links     = document.querySelectorAll('[data-legal-link]');
    if (secciones.length === 0 || links.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const id = entry.target.id;
            links.forEach(l => {
                l.classList.toggle('activo', l.dataset.legalLink === id);
            });
        });
    }, { rootMargin: '-25% 0px -70% 0px', threshold: 0 });

    secciones.forEach(s => observer.observe(s));

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (!href || !href.startsWith('#')) return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});
