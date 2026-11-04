import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { admin, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <div className="boot"><span className="ring-spin" /></div>
  if (!admin) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
