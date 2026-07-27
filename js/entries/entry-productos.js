// js/entries/entry-productos.js
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/productos.css';
import '../../css/auth.css';

import '../main.js';
import { iniciarCatalogo } from '../pages/productos.js';
import { iniciarAuthModal } from '../components/authModal.js';
import { inicializarAdmin } from '../utils/authService.js';

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
    iniciarAuthModal();
    iniciarCatalogo();
});
