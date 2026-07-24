import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import handlebars from 'vite-plugin-handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    base: '/maye-mundo-belleza/',
    root: '.',

    plugins: [
        handlebars({
            partialDirectory: resolve(__dirname, 'partials'),
            context: {
                base: '/maye-mundo-belleza/',
                assets: '/maye-mundo-belleza',
                rutas: {
                    home:      '/maye-mundo-belleza/index.html',
                    productos: '/maye-mundo-belleza/paginas/productos.html',
                    contacto:  '/maye-mundo-belleza/paginas/contacto.html',
                    legales:   '/maye-mundo-belleza/paginas/legales.html',
                    producto:  '/maye-mundo-belleza/paginas/producto.html',
                    admin:     '/maye-mundo-belleza/admin.html',
                },
            },
        }),
    ],

    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main:      resolve(__dirname, 'index.html'),
                productos: resolve(__dirname, 'paginas/productos.html'),
                contacto:  resolve(__dirname, 'paginas/contacto.html'),
                legales:   resolve(__dirname, 'paginas/legales.html'),
                producto:  resolve(__dirname, 'paginas/producto.html'),
                admin:     resolve(__dirname, 'admin.html'),
            },
        },
    },
});
