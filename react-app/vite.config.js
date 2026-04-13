import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Only use basicSsl for local dev server, not for production builds (Vercel handles SSL)
    command === 'serve' ? basicSsl() : null,
  ].filter(Boolean),
  server: {
    host: true,
  },
}))
