// js/entries/entry-index.js
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/index.css';

import '../main.js';
import { iniciarBotonesCarrito } from '../pages/index.js';
import { iniciarFAQ } from '../pages/faq.js';

document.addEventListener('DOMContentLoaded', () => {
    iniciarBotonesCarrito();
    iniciarFAQ();
});
