var _a;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var BACKEND_PORT = Number((_a = process.env.BACKEND_PORT) !== null && _a !== void 0 ? _a : 3847);
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': {
                target: "http://localhost:".concat(BACKEND_PORT),
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
