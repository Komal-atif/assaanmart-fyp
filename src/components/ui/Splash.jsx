import { useEffect, useState } from 'react'
import Logo from './Logo'

// "Welcome to AssanMart Admin ... Loading" screen shown after login and once when the app opens.
export default function Splash({ onDone, ms = 1900 }) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const a = setTimeout(() => setLeaving(true), ms)
    const b = setTimeout(onDone, ms + 450)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [ms, onDone])

  return (
    <div className={`splash ${leaving ? 'leaving' : ''}`} role="status" aria-label="Loading AssanMart Admin">
      <span className="leaf l1" /><span className="leaf l2" /><span className="leaf l3" /><span className="leaf l4" />
      <div className="splash-inner">
        <div className="splash-logo"><Logo height={74} /></div>
        <div className="splash-basket" aria-hidden="true">
          <svg viewBox="0 0 260 210" width="260" height="210">
            <g className="sb-items">
              <circle cx="92" cy="74" r="30" fill="#4c9f4a" /><circle cx="115" cy="62" r="26" fill="#5fb057" /><circle cx="76" cy="90" r="22" fill="#3f8b40" />
              <rect x="108" y="84" width="14" height="30" rx="7" fill="#7fb85a" />
              <circle cx="150" cy="82" r="24" fill="#e2483a" /><path d="M150 58q4-10 12-10" stroke="#3f8b40" strokeWidth="5" fill="none" strokeLinecap="round" />
              <path d="M174 78c18 0 28 14 24 30s-22 14-26 0-2-30 2-30Z" fill="#f4b73a" />
              <ellipse cx="196" cy="96" rx="14" ry="30" transform="rotate(24 196 96)" fill="#e8b36b" /><path d="M190 80l10 8M186 94l12 8" stroke="#c98d47" strokeWidth="3" strokeLinecap="round" />
              <path d="M62 100c-24-18-30-44-12-62 20 4 32 28 12 62Z" fill="#6bbb5c" />
            </g>
            <path d="M52 112h156l-14 70a12 12 0 0 1-12 10H78a12 12 0 0 1-12-10Z" fill="#5b9f6c" />
            <g stroke="#3f7c52" strokeWidth="3" strokeLinecap="round" opacity=".7"><path d="M58 132h144M62 152h136M66 172h128" /><path d="M96 114l4 76M130 114v78M164 114l-4 76" /></g>
            <rect x="44" y="104" width="172" height="14" rx="7" fill="#4d8f5f" />
            <path d="M70 108c-6-34 4-52 30-52" stroke="#4d8f5f" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".0" />
          </svg>
        </div>
        <h1>Welcome to AssanMart Admin</h1>
        <p>Managing your store, one order at a time.</p>
        <div className="splash-loader"><span className="ring-spin" /><em>Loading…</em></div>
      </div>
    </div>
  )
}
