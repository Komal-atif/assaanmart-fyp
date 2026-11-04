// Dashboard + analytics numbers. Everything is CALCULATED from the orders and products, nothing is hardcoded.
// "Sales" = all orders that are not Cancelled.
import { getOrders } from './orderService'
import { getProducts } from './productService'
import { getStockSummary } from './inventoryService'

export const STATUS_GROUPS = [
  { key: 'Delivered', match: ['Delivered'], color: '#2f8f5b' },
  { key: 'Processing', match: ['Confirmed', 'Packed', 'Out for Delivery'], color: '#4a9bd0' },
  { key: 'Pending', match: ['Pending'], color: '#f0a63a' },
  { key: 'Cancelled', match: ['Cancelled'], color: '#e0594f' },
]

const sum = (list, fn) => list.reduce((s, x) => s + fn(x), 0)
const pad = (n) => String(n).padStart(2, '0')
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`
const pct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

function totals(list) {
  const ok = list.filter((o) => o.status !== 'Cancelled')
  const sales = sum(ok, (o) => o.total)
  return { sales, orders: list.length, aov: ok.length ? sales / ok.length : 0 }
}

export async function getAnalytics(days = 7) {
  const [orders, products] = await Promise.all([getOrders(), getProducts()])
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(today); start.setDate(start.getDate() - (days - 1))
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - days)
  const at = (o) => new Date(o.createdAt).getTime()

  const cur = orders.filter((o) => at(o) >= start.getTime())
  const prev = orders.filter((o) => at(o) >= prevStart.getTime() && at(o) < start.getTime())
  const now = totals(cur)
  const before = totals(prev)

  // one point per day
  const series = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    series.push({
      key: dayKey(d),
      label: days <= 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      fullLabel: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      value: 0, orders: 0,
    })
  }
  const byKey = new Map(series.map((s) => [s.key, s]))
  for (const o of cur) {
    if (o.status === 'Cancelled') continue
    const slot = byKey.get(dayKey(new Date(o.createdAt)))
    if (slot) { slot.value += o.total; slot.orders++ }
  }

  const statusGroups = STATUS_GROUPS.map((g) => ({ ...g, count: cur.filter((o) => g.match.includes(o.status)).length }))

  const category = new Map(products.map((p) => [p.id, p.category || 'Other']))
  const prod = new Map()
  const cat = new Map()
  for (const o of cur) {
    if (o.status === 'Cancelled') continue
    for (const i of o.items) {
      const key = i.productId ?? i.name
      const row = prod.get(key) || { productId: i.productId, name: i.name, quantity: 0, revenue: 0 }
      row.quantity += i.quantity; row.revenue += i.quantity * i.price
      prod.set(key, row)
      const c = category.get(i.productId) || 'Other'
      cat.set(c, (cat.get(c) || 0) + i.quantity * i.price)
    }
  }
  const imageOf = new Map(products.map((p) => [p.id, p]))
  const topProducts = [...prod.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6)
    .map((t) => ({ ...t, imageUrl: imageOf.get(t.productId)?.imageUrl || null, category: imageOf.get(t.productId)?.category || null }))
  const byCategory = [...cat.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourLabel(h), count: 0 }))
  for (const o of cur) { const d = new Date(o.createdAt); if (!Number.isNaN(d.getTime())) hours[d.getHours()].count++ }

  return {
    days, hasOrders: orders.length > 0, hasPeriodOrders: cur.length > 0,
    totals: now,
    trends: { sales: pct(now.sales, before.sales), orders: pct(now.orders, before.orders), aov: pct(now.aov, before.aov) },
    series, statusGroups, topProducts, byCategory, hours,
    delivered: cur.filter((o) => o.status === 'Delivered').length,
    cancelled: cur.filter((o) => o.status === 'Cancelled').length,
    recent: orders.slice(0, 6),
    pendingAll: orders.filter((o) => o.status === 'Pending').length,
  }
}

// For the bell icon in the top bar
export async function getNotifications() {
  const [orders, stock] = await Promise.all([getOrders(), getStockSummary()])
  const pending = orders.filter((o) => o.status === 'Pending').length
  const list = []
  if (stock.out) list.push({ id: 'out', tone: 'red', text: `${stock.out} products are out of stock`, to: '/low-stock' })
  if (stock.low) list.push({ id: 'low', tone: 'amber', text: `${stock.low} products are running low`, to: '/low-stock' })
  if (pending) list.push({ id: 'pend', tone: 'blue', text: `${pending} orders are waiting to be confirmed`, to: '/orders?status=Pending' })
  return list
}
