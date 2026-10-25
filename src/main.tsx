import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initHub } from './lib/hub-client'
import './index.css'

const root = document.getElementById('root')

void initHub()
  .catch((err) => {
    console.error('[wtf-hub] hub init failed', err)
  })
  .finally(() => {
    createRoot(root!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
