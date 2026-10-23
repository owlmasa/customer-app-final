import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminDashboard } from './admin/AdminDashboard'
import { LiffGate } from './liff/LiffGate'
import { FollowRequest } from './follow/FollowRequest'

// /admin は親機（全体モニター）
const path = window.location.pathname.replace(/\/+$/, '')
const isAdmin = path === '/admin'
// /follow はフォロー依頼
const isFollow = path === '/follow'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LiffGate>{isAdmin ? <AdminDashboard /> : isFollow ? <FollowRequest /> : <App />}</LiffGate>
  </StrictMode>,
)


