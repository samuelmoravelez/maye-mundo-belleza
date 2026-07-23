import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',

    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main:      resolve(__dirname, 'index.html'),
                productos: resolve(__dirname, 'paginas/productos.html'),
                contacto:  resolve(__dirname, 'paginas/contacto.html'),
                admin:     resolve(__dirname, 'admin.html'),
            },
        },
    },

    server: {
        open: true,
        port: 5173,
    },
});
