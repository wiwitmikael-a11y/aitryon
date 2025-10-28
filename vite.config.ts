import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:5173' // Proxy API requests to Vercel dev server
    }
  },
  plugins: [react()],
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY)
  },
  resolve: {
    alias: {
      '@': '/src',
    }
  }
});
