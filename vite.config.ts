import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build runs from any sub-path (GitHub Pages serves it
// from /PJKT_GNS/).
export default defineConfig({
  base: './',
  plugins: [react()],
})
