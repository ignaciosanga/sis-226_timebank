import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/front_end_decisiones_gerenciales/' : '/',
  plugins: [vue()],
}))
