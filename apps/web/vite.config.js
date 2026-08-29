import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Allow the sandbox preview proxy host. Dev-only; production is served by Vercel.
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Keep the initial script below the ~500 kB advisory. Vendor groups are
    // cached independently, so a dependency upgrade only invalidates its own
    // chunk. Route components are already lazy-loaded via React.lazy.
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-ui': [
            'sonner',
            'framer-motion',
            'react-hook-form',
            'zod',
            'date-fns',
          ],
        },
      },
    },
  },
});
