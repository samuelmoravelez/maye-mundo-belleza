import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import handlebars from 'vite-plugin-handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    base: '/',
    root: '.',

    plugins: [
        handlebars({
            partialDirectory: resolve(__dirname, 'partials'),
            context: {
                base: '/',
                assets: '',
                rutas: {
                    home:          '/index.html',
                    productos:     '/paginas/productos.html',
                    contacto:      '/paginas/contacto.html',
                    legales:       '/paginas/legales.html',
                    producto:      '/paginas/producto.html',
                    admin:         '/admin.html',
                    dashboard:     '/dashboard.html',
                    checkout:      '/checkout.html',
                    pedidoExitoso: '/pedido-exitoso.html',
                    notFound:      '/404.html',
                },
            },
        }),
    ],

    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main:          resolve(__dirname, 'index.html'),
                productos:     resolve(__dirname, 'paginas/productos.html'),
                contacto:      resolve(__dirname, 'paginas/contacto.html'),
                legales:       resolve(__dirname, 'paginas/legales.html'),
                producto:      resolve(__dirname, 'paginas/producto.html'),
                admin:         resolve(__dirname, 'admin.html'),
                dashboard:     resolve(__dirname, 'dashboard.html'),
                checkout:      resolve(__dirname, 'checkout.html'),
                pedidoExitoso: resolve(__dirname, 'pedido-exitoso.html'),
                notFound:      resolve(__dirname, '404.html'),
            },
        },
    },
});