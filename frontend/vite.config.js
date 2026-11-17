import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('recharts') ||
            id.includes('victory-vendor') ||
            id.includes('d3-') ||
            id.includes('@reduxjs/toolkit') ||
            id.includes('react-redux') ||
            id.includes('immer')
          ) {
            return 'vendor-charts';
          }
          if (
            id.includes('jspdf') ||
            id.includes('pdfkit') ||
            id.includes('html2pdf') ||
            id.includes('html2canvas')
          ) {
            return 'vendor-pdf';
          }
          if (
            id.includes('react-router') ||
            id.includes('react-router-dom') ||
            id.includes('/react/') ||
            id.includes('\\react\\') ||
            id.includes('/react-dom/') ||
            id.includes('\\react-dom\\') ||
            id.includes('/react-is/') ||
            id.includes('\\react-is\\') ||
            id.includes('scheduler')
          ) {
            return 'vendor-react';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('socket.io') || id.includes('engine.io') || id.includes('axios')) {
            return 'vendor-network';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
