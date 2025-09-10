// Context7: consulted for vite
// Context7: consulted for @vitejs/plugin-react
// Critical-Engineer: consulted for Build system and quality assurance strategy
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': '/src'
        }
    },
    server: {
        port: 3000,
        open: true
    }
});
