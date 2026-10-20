import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        // In development, the browser calls /api/... on this dev server, and Vite forwards it to the
        // backend. Same origin for the browser = no CORS setup needed.
        // Backend on another port? Start with API_PROXY_TARGET=http://localhost:<port> npm run dev
        proxy: {
            '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
        },
    },
});
