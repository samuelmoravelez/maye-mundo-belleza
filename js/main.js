// js/main.js
// Punto de entrada compartido — inicializa los componentes presentes
// en TODAS las páginas. Ejecutan de forma segura (si el elemento no
// existe en el DOM, no hacen nada).

import { iniciarMenu }            from './components/menu.js';
import { iniciarCarritoDrawer }   from './components/carritoDrawer.js';
import { iniciarBarraAnuncio }    from './components/barraAnuncio.js';
import { iniciarWhatsAppDinamico } from './components/whatsappFlotante.js';
import { iniciarNavActivo }       from './components/navActivo.js';

document.addEventListener('DOMContentLoaded', () => {
    iniciarNavActivo();        // 1. Marca link activo en el menú
    iniciarBarraAnuncio();     // 2. Anuncios rotativos
    iniciarWhatsAppDinamico(); // 3. Enlaces WA con número centralizado
    iniciarMenu();             // 4. Botón hamburguesa móvil
    iniciarCarritoDrawer();    // 5. Drawer del carrito lateral
});
