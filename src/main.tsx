import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles/app.css'
import App from './App.tsx'
import { allFontUrls } from './fonts/registry'
import { useEditor } from './store/editor'
import { restore, startAutosave } from './store/persist'

// iPad/Safari: pinches belong to the canvas, never to zooming the whole page.
document.addEventListener('gesturestart', (e) => e.preventDefault())

// Pick up the last session, then keep saving.
void restore().then((had) => {
  startAutosave()
  if (had) {
    useEditor.getState().requestFit()
    useEditor.getState().flash('Welcome back — your last session is restored', 'info')
  }
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Offline support: the app shell and fonts are cached after the first visit.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Once idle, quietly fetch the whole cover-font library (~4 MB) for offline use.
        const later = (window as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 8000))
        later(() => reg.active?.postMessage({ type: 'precache', urls: allFontUrls() }))
      })
      .catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
