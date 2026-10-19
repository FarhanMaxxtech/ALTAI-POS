import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        // In development, the browser calls /api/... on this dev server, and Vite forwards it to the
        // backend. Same origin for the browser = no CORS setup needed.
        proxy: {
            '/api': 'http://localhost:3001',
        },
    },
});
