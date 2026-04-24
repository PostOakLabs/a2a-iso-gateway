import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/payments': 'http://localhost:3000',
      '/webhooks': 'http://localhost:3000',
      '/reset': 'http://localhost:3000',
    },
  },
});
