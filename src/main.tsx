import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminDashboard } from './admin/AdminDashboard'
import { LiffGate } from './liff/LiffGate'

// /admin は親機（全体モニター）
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LiffGate>{isAdmin ? <AdminDashboard /> : <App />}</LiffGate>
  </StrictMode>,
)


