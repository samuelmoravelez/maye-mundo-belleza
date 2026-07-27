// js/entries/entry-contacto.js
import '../../css/variables.css';
import '../../css/global.css';
import '../../css/carrito.css';
import '../../css/contacto.css';
import '../../css/auth.css';

import '../main.js';
import { iniciarFormulario } from '../pages/contacto.js';
import { iniciarAuthModal } from '../components/authModal.js';
import { inicializarAdmin } from '../utils/authService.js';

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
    iniciarAuthModal();
    iniciarFormulario();
});
