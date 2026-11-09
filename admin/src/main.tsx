import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { SetupNeeded } from './components/SetupNeeded'
import { ToastProvider } from './components/Toast'
import { missingConfig } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {missingConfig ? (
      <SetupNeeded />
    ) : (
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
)
