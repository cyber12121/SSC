import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('node_modules')) {
              if (normalizedId.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (normalizedId.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (normalizedId.includes('motion')) {
                return 'vendor-motion';
              }
              if (normalizedId.includes('react') || normalizedId.includes('react-dom')) {
                return 'vendor-react';
              }
            }
            if (normalizedId.includes('/src/data/')) {
              if (normalizedId.includes('/mathematics/')) return 'data-mathematics';
              if (normalizedId.includes('/general_awareness/')) return 'data-general-awareness';
              if (normalizedId.includes('/gk_full_tests/')) return 'data-gk-full-tests';
              if (normalizedId.includes('/english/')) return 'data-english';
              if (normalizedId.includes('/reasoning/')) return 'data-reasoning';
              if (normalizedId.includes('/drills/')) return 'data-drills';
              if (normalizedId.includes('/mock_errors/')) return 'data-mock-errors';
              return 'data-other';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
