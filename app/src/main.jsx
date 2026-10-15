import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SetupNotice } from './components/SetupNotice'
import { isConfigured } from './lib/supabase'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isConfigured ? <App /> : <SetupNotice />}
  </StrictMode>,
)
