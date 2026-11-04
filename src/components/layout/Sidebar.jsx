import { NavLink, useLocation } from 'react-router-dom'
import useAsync from '../../hooks/useAsync'
import { useAuth } from '../../context/AuthContext'
import { getStockSummary } from '../../services/inventoryService'
import Icon from '../ui/Icon'
import Logo from '../ui/Logo'
import Avatar from '../ui/Avatar'

const LINKS = [
  ['/dashboard', 'Dashboard', 'dashboard'],
  ['/orders', 'Orders', 'orders'],
  ['/products', 'Products', 'products'],
  ['/inventory', 'Inventory', 'inventory'],
  ['/low-stock', 'Low Stock', 'alert'],
  ['/customers', 'Customers', 'customers'],
  ['/analytics', 'Analytics', 'analytics'],
  ['/settings', 'Settings', 'settings'],
]

export default function Sidebar({ open, onLogout, onClose }) {
  const { pathname } = useLocation()
  const { admin } = useAuth()
  const { data } = useAsync(getStockSummary, [pathname])
  const alerts = data ? data.low + data.out : 0

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <Logo height={54} className="brand-logo" />
        <button className="icon-btn close-menu" onClick={onClose} aria-label="Close menu"><Icon name="x" /></button>
      </div>
      <nav aria-label="Main menu">
        {LINKS.map(([to, label, icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon name={icon} size={19} />
            <span>{label}</span>
            {to === '/low-stock' && alerts > 0 && <span className="nav-badge">{alerts}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="side-profile">
        <Avatar name={admin?.name} size={40} />
        <div className="who"><strong>{admin?.name}</strong><span>Admin</span></div>
        <button className="icon-btn logout-btn" onClick={onLogout} aria-label="Log out" title="Log out"><Icon name="logout" size={18} /></button>
      </div>
    </aside>
  )
}
