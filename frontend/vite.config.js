import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH ?? (command === 'build' ? '/front_end_decisiones_gerenciales/' : '/'),
  plugins: [vue()],
}))
