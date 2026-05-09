import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/bookspeak/',
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/tts': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/translate': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/dict': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
