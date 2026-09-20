import { defineConfig } from 'vite';
import { SERVER_PORT } from './src/shared/constants';

export default defineConfig({
  server: {
    port: 5173,
    // El cliente se conecta a ws://<host>/ws y Vite lo reenvía al servidor de juego,
    // así en desarrollo todo vive en un mismo origen.
    proxy: {
      '/ws': {
        target: `ws://localhost:${SERVER_PORT}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
