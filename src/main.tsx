import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import './editor-styles.css'
import App from './App.tsx'
import { applyTheme, loadTheme } from './lib/themes'

applyTheme(loadTheme(), false)

// Once the app has been opened online, let it open again with no connection. Skipped in development, and in the
// desktop app, which loads from files and has no use for it.
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </HelmetProvider>
  </StrictMode>,
)
