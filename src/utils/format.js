// Display helpers shared by all pages.
export function formatPKR(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—'
  const n = Number(amount)
  return `Rs ${n.toLocaleString('en-PK', Number.isInteger(n) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// 32450 -> "32.5K", 1250000 -> "1.25M" (chart axes)
export function formatShort(n) {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `${+(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e3) return `${+(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`
  return String(Math.round(v))
}

export function formatDate(iso) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return '—'
  return `${formatDate(iso)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

// "1.0" + "L" -> "1 L",  "Small" -> "Small",  nothing -> "—"
export function formatPackage(product) {
  const size = product.packageSize
  const n = Number(size)
  const shown = size && Number.isFinite(n) ? String(n) : size
  const out = [shown, product.unit].filter(Boolean).join(' ')
  return out || '—'
}

export const formatStock = (qty) => (qty === null || qty === undefined ? 'Not set' : String(qty))

// "snacks&Biscuits" -> "Snacks & Biscuits", "Fruits&Vegetables" -> "Fruits & Vegetables"
export function catLabel(c) {
  if (!c) return 'Other'
  return c.replace(/\s*&\s*/g, ' & ').replace(/^./, (x) => x.toUpperCase())
}

export const orderNo = (id) => `#${String(id)}`
export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
const AVATARS = ['#2f8f5b', '#4a9bd0', '#e0894a', '#8a6bd1', '#d4607f', '#3aa59a', '#c79a2b', '#5a7bd6']
export function avatarColor(name) {
  let h = 0
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATARS[h % AVATARS.length]
}
export function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}
