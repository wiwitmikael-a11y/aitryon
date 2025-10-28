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
  // The define block for GEMINI_API_KEY has been removed.
  // This is a security risk as it exposes the key to the client-side code.
  // The backend API (`/api/gemini-proxy`) securely accesses the API key
  // directly from the server's environment variables.
  resolve: {
    alias: {
      '@': '/src',
    }
  }
});
