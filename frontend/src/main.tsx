// Polyfill `global` for libraries like sockjs-client that expect Node.js globals
;(window as any).global = window.globalThis || window

import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)


