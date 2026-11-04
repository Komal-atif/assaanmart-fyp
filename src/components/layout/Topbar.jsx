import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import useAsync from '../../hooks/useAsync'
import useClickOutside from '../../hooks/useClickOutside'
import { getNotifications } from '../../services/analyticsService'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'

export default function Topbar({ onMenu, onLogout }) {
  const { admin } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [q, setQ] = useState('')
  const [bell, setBell] = useState(false)
  const [menu, setMenu] = useState(false)
  const bellRef = useRef(null)
  const menuRef = useRef(null)
  const notes = useAsync(getNotifications, [pathname])
  useClickOutside(bellRef, () => setBell(false), bell)
  useClickOutside(menuRef, () => setMenu(false), menu)
  const list = notes.data || []

  function search(e) {
    e.preventDefault()
    const term = q.trim()
    navigate(term ? `/products?q=${encodeURIComponent(term)}` : '/products')
  }

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu"><Icon name="menu" size={20} /></button>
      <form className="search" onSubmit={search} role="search">
        <Icon name="search" size={17} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search anything…" aria-label="Search all products" />
      </form>

      <div className="top-actions">
        <div className="pop-wrap" ref={bellRef}>
          <button className="icon-btn round" onClick={() => { setBell(!bell); setMenu(false) }} aria-label="Notifications" aria-expanded={bell}>
            <span key={list.length} className={list.length ? 'bell-ring' : ''}><Icon name="bell" size={19} /></span>
            {list.length > 0 && <span className="bell-dot" />}
          </button>
          {bell && (
            <div className="popover notes">
              <div className="pop-title">Notifications</div>
              {list.length === 0 ? <p className="muted pad">You are all caught up.</p> : list.map((n) => (
                <button key={n.id} className="note" onClick={() => { setBell(false); navigate(n.to) }}>
                  <i className={`note-dot ${n.tone}`} />{n.text}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="icon-btn round" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
        </button>

        <div className="pop-wrap" ref={menuRef}>
          <button className="me" onClick={() => { setMenu(!menu); setBell(false) }} aria-expanded={menu}>
            <Avatar name={admin?.name} size={38} />
            <span className="me-text"><strong>{admin?.name}</strong><small>Admin</small></span>
            <Icon name="chevron" size={16} className={`chev ${menu ? 'flip' : ''}`} />
          </button>
          {menu && (
            <div className="popover menu-pop">
              <button onClick={() => { setMenu(false); navigate('/settings') }}><Icon name="settings" size={16} />Settings</button>
              <button className="danger-item" onClick={() => { setMenu(false); onLogout() }}><Icon name="logout" size={16} />Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
