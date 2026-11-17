// Orders placed in the store / by the voice agent, straight from the database.
import { api } from './api'

export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled']
const toApiStatus = (s) => String(s).toLowerCase().replace(/\s+/g, '_')
const fromApiStatus = (v) => {
  const k = String(v ?? '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
  return ORDER_STATUSES.find((x) => x.toLowerCase() === k) || 'Pending'
}
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const text = (v) => (v === undefined || v === null ? '' : String(v).trim())

function normalize(r) {
  const items = (r.items || []).map((i) => ({
    productId: i.id ?? i.product_id ?? null, name: text(i.name), quantity: num(i.quantity), price: num(i.unit_price ?? i.price),
  }))
  return {
    id: r.id, customerName: text(r.customer_name), customerPhone: text(r.phone),
    address: [text(r.address), text(r.city)].filter(Boolean).join(', '),
    paymentMethod: text(r.payment_method), status: fromApiStatus(r.status), items,
    total: num(r.total), createdAt: r.created_at ? (/[zZ]|[+-]\d\d:?\d\d$/.test(r.created_at) ? r.created_at : `${r.created_at}Z`) : '',
    updatedAt: '', source: text(r.source), deliveryFee: num(r.delivery_fee),
  }
}

// Newest first. Optional: getOrders({ status: 'Pending' })
export async function getOrders({ status } = {}) {
  const rows = (await api('/admin/orders')).orders.map(normalize).filter((o) => o.id !== '' && o.id != null)
  return rows.filter((o) => !status || o.status === status).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function getOrder(id) {
  try { return normalize((await api(`/admin/orders/${id}`)).order) } catch (e) { if (/not found/i.test(e.message)) return null; throw e }
}

export async function updateOrderStatus(id, status) {
  if (!ORDER_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`)
  const r = await api(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status: toApiStatus(status) } })
  return normalize({ items: [], ...r.order })
}