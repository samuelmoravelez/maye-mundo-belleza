// js/entries/entry-confirmacion.js
// ─────────────────────────────────────────────────────────────────────────────
// Entry point de la pantalla de confirmación de pago de Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────

import '../../css/variables.css';
import '../../css/global.css';
import '../../css/checkout.css';

import { inicializarAdmin } from '../utils/authService.js';
import { iniciarConfirmacionPago } from '../pages/confirmacion.js';

inicializarAdmin();

document.addEventListener('DOMContentLoaded', async () => {
    await iniciarConfirmacionPago();
});
