import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// GitHub Pages project site lives at /las-misiones-del-huerto/
export default defineConfig({
  base: '/las-misiones-del-huerto/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        ninos: resolve(__dirname, 'index.html'),
        padres: resolve(__dirname, 'padres/index.html'),
      },
    },
  },
})
