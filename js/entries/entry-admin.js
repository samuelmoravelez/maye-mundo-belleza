// js/entries/entry-admin.js
// Entry point exclusivo del panel de administración.

import '../../css/variables.css';
import '../../css/admin.css';

import { iniciarAdmin } from '../pages/admin.js';

document.addEventListener('DOMContentLoaded', () => {
    iniciarAdmin();
});
