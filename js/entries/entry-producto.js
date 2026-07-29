// js/entries/entry-producto.js
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/producto.css';
import '../../css/auth.css';
import '../../css/wishlist-quickview.css';

import '../main.js';
import { iniciarDetalleProducto } from '../pages/producto.js';
import { iniciarAuthModal } from '../components/authModal.js';
import { inicializarAdmin } from '../utils/authService.js';

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
    iniciarAuthModal();
    iniciarDetalleProducto();
});
