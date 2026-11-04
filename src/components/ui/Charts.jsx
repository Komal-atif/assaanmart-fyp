// Plain SVG/CSS charts (no chart library). All of them animate in and react to hover/touch.
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatShort } from '../../utils/format'

// ---------- helpers ----------
function niceMax(v) {
  if (v <= 0) return 10
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return step * exp
}

// smooth line through points without overshooting (monotone cubic)
function smoothPath(pts) {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0].x},${pts[0].y}`
  const dx = [], s = []
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; s[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1) }
  const m = [s[0]]
  for (let i = 1; i < n - 1; i++) m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2
  m[n - 1] = s[n - 2]
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / s[i], b = m[i + 1] / s[i], h = a * a + b * b
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * s[i]; m[i + 1] = t * b * s[i] }
  }
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const k = dx[i] / 3
    d += ` C${pts[i].x + k},${pts[i].y + m[i] * k} ${pts[i + 1].x - k},${pts[i + 1].y - m[i + 1] * k} ${pts[i + 1].x},${pts[i + 1].y}`
  }
  return d
}

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    if (!ref.current) return undefined
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// ---------- AreaChart: smooth line + gradient, tooltip follows the mouse/finger ----------
// data: [{ label, fullLabel?, value }]    format: (value) => string
export function AreaChart({ data, format = (v) => String(v), height = 270, color = '#2f8f5b' }) {
  const [ref, width] = useWidth()
  const peak = useMemo(() => data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0), [data])
  const [hover, setHover] = useState(null)
  const active = hover ?? peak
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), [])

  const pad = { l: 46, r: 16, t: 18, b: 30 }
  const iw = width - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const top = niceMax(Math.max(...data.map((d) => d.value), 0) * 1.08)
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i)
  const x = (i) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v) => pad.t + ih - (v / top) * ih
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.value) }))
  const line = smoothPath(pts)
  const area = pts.length ? `${line} L${pts[pts.length - 1].x},${pad.t + ih} L${pts[0].x},${pad.t + ih} Z` : ''
  const every = data.length > 24 ? Math.ceil(data.length / 8) : data.length > 10 ? Math.ceil(data.length / 7) : 1

  function move(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) - pad.l
    const i = Math.round((px / iw) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  const a = data[active]
  const tipLeft = Math.min(Math.max(pts[active]?.x ?? 0, 70), width - 70)

  return (
    <div className="chart-box" ref={ref} style={{ height }}>
      <svg width={width} height={height} role="img" aria-label="Sales over time" key={`${data.length}-${data[0]?.label}-${top}`}>
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" className="axis">{formatShort(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % every === 0 ? <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="axis">{d.label}</text> : null))}
        <path d={area} fill={`url(#g${uid})`} className="area-fill" />
        <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="area-line" />
        {pts[active] && <line x1={pts[active].x} x2={pts[active].x} y1={pad.t} y2={pad.t + ih} className="cursor-line" />}
        {data.length <= 16 && pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === active ? 0 : 3.5} fill="var(--surface)" stroke={color} strokeWidth="2" className="area-dot" />)}
        {pts[active] && <circle cx={pts[active].x} cy={pts[active].y} r="6.5" fill="var(--surface)" stroke={color} strokeWidth="3.5" className="active-dot" />}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y', cursor: 'crosshair' }} />
      </svg>
      {a && pts[active] && (
        <div className="chart-tip" style={{ left: tipLeft, top: Math.max(0, pts[active].y - 58) }}>
          <small>{a.fullLabel || a.label}</small>
          <strong>{format(a.value)}</strong>
        </div>
      )}
    </div>
  )
}

// ---------- Donut: hover a slice or a legend row to inspect it ----------
// data: [{ label, value, color }]
export function Donut({ data, centerLabel = 'Total', onSelect, size = 168 }) {
  const [hot, setHot] = useState(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  const R = 62
  const C = 2 * Math.PI * R
  let offset = 0
  const cur = hot !== null ? data[hot] : null
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0)

  return (
    <div className="donut-wrap">
      <div className="donut" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label="Donut chart" key={total}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--mint)" strokeWidth="20" />
          {total > 0 && data.map((d, i) => {
            if (d.value <= 0) return null
            const len = (d.value / total) * C
            const gap = data.filter((x) => x.value > 0).length > 1 ? Math.min(3, len * 0.2) : 0
            const el = (
              <circle
                key={d.label} cx="80" cy="80" r={R} fill="none" stroke={d.color}
                strokeWidth={hot === i ? 25 : 20}
                strokeDasharray={`${Math.max(0, len - gap)} ${C - len + gap}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
                className="donut-arc"
                style={{ '--c': C, animationDelay: `${i * 0.12}s`, opacity: hot === null || hot === i ? 1 : 0.35, cursor: onSelect ? 'pointer' : 'default' }}
                onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} onClick={() => onSelect?.(d)}
              />
            )
            offset += len
            return el
          })}
        </svg>
        <div className="donut-center">
          <strong>{cur ? cur.value.toLocaleString() : total.toLocaleString()}</strong>
          <span>{cur ? `${cur.label} · ${pct(cur.value)}%` : centerLabel}</span>
        </div>
      </div>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.label} className={hot === i ? 'hot' : ''} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} onClick={() => onSelect?.(d)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <i className="dot" style={{ background: d.color }} />
            <span>{d.label}</span>
            <strong>{pct(d.value)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- BarChart: bars grow in, the highest one is highlighted ----------
// data: [{ label, value }]
export function BarChart({ data, labelEvery = 1, unit = '', format, height = 200 }) {
  const [hot, setHot] = useState(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const peak = Math.max(0, ...data.map((d) => d.value))
  const show = (v) => (format ? format(v) : `${v}${unit}`)
  return (
    <div className="bars-chart" style={{ height }} role="img" aria-label="Bar chart">
      {data.map((d, i) => (
        <div className="bar-col" key={`${d.label}-${i}`} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
          <div className="bar-area">
            {hot === i && <span className="bar-tip">{d.fullLabel || d.label}<b>{show(d.value)}</b></span>}
            <div className={`bar ${peak > 0 && d.value === peak ? 'peak' : ''}`} style={{ height: `${(d.value / max) * 100}%`, animationDelay: `${Math.min(i * 0.025, 0.5)}s` }} />
          </div>
          <span className="bar-label">{i % labelEvery === 0 ? d.label : ''}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- HBars: horizontal bars with a colour per row ----------
// data: [{ label, value, display, color?, image? }]
const PALETTE = ['#2f8f5b', '#4a9bd0', '#f0a63a', '#8a6bd1', '#3aa59a', '#e0894a', '#d4607f', '#7aa83a']
export function HBars({ data, onSelect }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="hbars">
      {data.map((d, i) => (
        <div className={`hbar ${onSelect ? 'click' : ''}`} key={d.label} onClick={onSelect ? () => onSelect(d) : undefined}>
          <div className="hbar-top"><span title={d.label}>{d.label}</span><strong>{d.display ?? d.value}</strong></div>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color || PALETTE[i % PALETTE.length], animationDelay: `${i * 0.07}s` }} /></div>
        </div>
      ))}
    </div>
  )
}

export { PALETTE }
