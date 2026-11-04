// Orders for the admin portal. There is no orders sheet yet, so this starts EMPTY (no fake orders).
// When the backend/database writes orders, only this file changes (fetch instead of loadTable).
import { loadTable, saveTable, pick, toIso } from './dataStore'

const TABLE = 'orders'
export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled']

// Old/other names -> our names (the customer app timeline uses "Order Placed")
const STATUS_ALIASES = { 'order placed': 'Pending', processing: 'Confirmed', shipped: 'Out for Delivery' }

const text = (v) => (v === undefined || v === null ? '' : String(v).trim())
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

function normalizeStatus(v) {
  const s = text(v).toLowerCase()
  return ORDER_STATUSES.find((x) => x.toLowerCase() === s) || STATUS_ALIASES[s] || 'Pending'
}

function normalizeItems(v) {
  let list = v
  if (typeof list === 'string') {
    try { list = JSON.parse(list) } catch { list = [] }
  }
  if (!Array.isArray(list)) return []
  return list.map((i) => ({
    productId: pick(i, 'productId', 'product_id', 'id') ?? null,
    name: text(pick(i, 'name', 'product_name')),
    quantity: num(pick(i, 'quantity', 'qty')),
    price: num(pick(i, 'price', 'unit_price')),
  }))
}

function normalizeOrder(r) {
  const items = normalizeItems(pick(r, 'items', 'order_items'))
  const total = pick(r, 'total', 'total_amount')
  return {
    id: pick(r, 'id', 'order_id') ?? '',
    customerName: text(pick(r, 'customerName', 'customer_name', 'customer')),
    customerPhone: text(pick(r, 'customerPhone', 'customer_phone', 'phone')),
    address: text(pick(r, 'address', 'delivery_address')),
    paymentMethod: text(pick(r, 'paymentMethod', 'payment_method', 'payment')),
    status: normalizeStatus(pick(r, 'status')),
    items,
    total: total !== undefined ? num(total) : items.reduce((s, i) => s + i.quantity * i.price, 0),
    createdAt: toIso(pick(r, 'createdAt', 'created_at', 'date')),
    updatedAt: toIso(pick(r, 'updatedAt', 'updated_at')),
  }
}

const copy = (o) => ({ ...o, items: o.items.map((i) => ({ ...i })) })

// One-time cleanup of sample orders saved by older versions
if (!localStorage.getItem('assanmart:orders-clean')) {
  localStorage.removeItem('assanmart:orders')
  localStorage.setItem('assanmart:orders-clean', '1')
}

async function table() {
  const rows = await loadTable(TABLE, normalizeOrder)
  return rows.filter((o) => o.id !== '')
}

// Newest first. Optional: getOrders({ status: 'Pending' })
export async function getOrders({ status } = {}) {
  const rows = (await table()).filter((o) => !status || o.status === status)
  return rows.map(copy).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function getOrder(id) {
  const found = (await table()).find((o) => String(o.id) === String(id))
  return found ? copy(found) : null
}

export async function updateOrderStatus(id, status) {
  if (!ORDER_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`)
  const rows = await table()
  const index = rows.findIndex((o) => String(o.id) === String(id))
  if (index === -1) throw new Error('Order not found.')
  const next = [...rows]
  next[index] = { ...rows[index], status, updatedAt: new Date().toISOString() }
  saveTable(TABLE, next)
  return copy(next[index])
}
