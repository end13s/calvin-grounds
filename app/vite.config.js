import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // MapLibre 6 starts its worker as an ES module, so bundle workers as ES modules too.
  worker: { format: 'es' },
})
