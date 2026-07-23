// js/entries/entry-productos.js
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/index.css';
import '../../css/productos.css';

import '../main.js';
import { iniciarCatalogo } from '../pages/productos.js';

document.addEventListener('DOMContentLoaded', () => {
    iniciarCatalogo();
});
