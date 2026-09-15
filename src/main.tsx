import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { captureInstallPrompt, registerServiceWorker } from './lib/push'

// Before React renders: Chrome fires beforeinstallprompt once, early, and a
// page that was not listening yet cannot offer a one-tap Install button.
captureInstallPrompt()
void registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
