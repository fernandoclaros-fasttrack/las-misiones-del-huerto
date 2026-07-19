import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// GitHub Pages project site lives at /las-misiones-del-huerto/ — only needed for the
// production build. In dev, keeping base at '/' lets the preview server respond at the
// server root (some preview tools poll '/' to detect readiness and never resolve otherwise).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/las-misiones-del-huerto/' : '/',
  server: { port: Number(process.env.PORT) || 5173 },
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        ninos: resolve(__dirname, 'index.html'),
        padres: resolve(__dirname, 'padres/index.html'),
      },
    },
  },
}))
