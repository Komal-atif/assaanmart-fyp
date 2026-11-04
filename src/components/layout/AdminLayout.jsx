import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ConfirmModal from '../ui/ConfirmModal'

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  useEffect(() => { setOpen(false) }, [pathname])

  const askLogout = useCallback(() => { setOpen(false); setAsking(true) }, [])

  async function confirmLogout() {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 750)) // short, so the spinner is seen
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="admin">
      <Sidebar open={open} onLogout={askLogout} onClose={() => setOpen(false)} />
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setOpen(true)} onLogout={askLogout} />
        <div className="page-slot" key={pathname}>
          <Outlet context={{ askLogout }} />
        </div>
      </div>
      {asking && (
        <ConfirmModal
          icon="logout" title="Log out of AssanMart?" busy={busy}
          text="You will need to sign in again to manage orders, products and stock."
          confirmLabel="Yes, log out" onCancel={() => setAsking(false)} onConfirm={confirmLogout}
        />
      )}
    </div>
  )
}
