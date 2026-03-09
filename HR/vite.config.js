import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load .env from project root (one level above HR/)
  const rootDir = path.resolve(__dirname, '..')
  const env = loadEnv(mode, rootDir, '')
  const backendUrl = env.VITE_API_BASE_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    // Tell Vite to read .env from the project root for import.meta.env
    envDir: rootDir,
    server: {
      proxy: {
        "/api/v1": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})



