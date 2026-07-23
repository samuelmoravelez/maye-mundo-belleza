// js/main.js
// Punto de entrada compartido — inicializa los componentes presentes
// en TODAS las páginas: menú hamburguesa y drawer del carrito.

import { iniciarMenu } from './components/menu.js';
import { iniciarCarritoDrawer } from './components/carritoDrawer.js';

document.addEventListener('DOMContentLoaded', () => {
    iniciarMenu();
    iniciarCarritoDrawer();
});
