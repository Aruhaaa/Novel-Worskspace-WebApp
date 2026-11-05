import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Which build this is, so a report of something that went wrong says which release it came from: the version in
// package.json, plus the first letters of the commit when the host (Vercel) says which one it is.
const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string }).version ?? '0.0.0'
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '').slice(0, 7)
const buildId = (commit ? `${version}+${commit}` : version).slice(0, 40)

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  build: {
    rolldownOptions: {
      output: {
        // The libraries that rarely change get their own files, so a returning visitor keeps them cached
        // across new releases of the app itself.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
})
