import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Fix: Define __dirname for ESM environments as it is not globally available
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      proxy: {
        '/storage-proxy': {
          target: 'https://firebasestorage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/storage-proxy/, '')
        },
        '/api_proxy': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api_proxy/, '')
        },
        '/fema-flood-proxy': {
          target: 'https://hazards.fema.gov',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/fema-flood-proxy/, '')
        },
        '/fema-api-proxy': {
          target: 'https://www.fema.gov',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/fema-api-proxy/, '')
        },
        '/usdm-proxy': {
          target: 'https://usdmdataservices.unl.edu',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/usdm-proxy/, '')
        },
        '/gmaps-proxy': {
          target: 'https://maps.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/gmaps-proxy/, '')
        },
        '/realestateapi-proxy': {
          target: 'https://api.realestateapi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/realestateapi-proxy/, '')
        },
      }
    },
    plugins: [react()],
    define: {
      'process.env.MAPS_API_KEY': JSON.stringify(env.MAPS_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      extensions: ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json'],
    },
    optimizeDeps: {
      include: ['@google/genai']
    },
    build: {
      rollupOptions: {
      }
    }
  };
});