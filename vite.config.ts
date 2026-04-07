import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@ecs': '/src/ecs',
      '@managers': '/src/managers',
      '@systems': '/src/systems',
      '@scenes': '/src/scenes',
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2022'
  },
  server: {
    port: 3000
  }
})
