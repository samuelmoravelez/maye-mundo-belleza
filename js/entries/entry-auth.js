// js/entries/entry-auth.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point del módulo de Autenticación.
// Importado por TODAS las páginas públicas (index, productos, producto,
// contacto, legales) para tener el modal disponible en todo el sitio.
//
// NO se importa en admin.html — esa página tiene su propia lógica.
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/auth.css';

import '../main.js';
import { iniciarAuthModal } from '../components/authModal.js';

document.addEventListener('DOMContentLoaded', () => {
    iniciarAuthModal();
});
