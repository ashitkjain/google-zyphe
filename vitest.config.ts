import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        include: ['**/*.test.ts'],
        exclude: ['**/*.batch.test.ts', '**/node_modules/**', '**/dist/**'],
    },
});
