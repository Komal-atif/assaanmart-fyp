// Customers are built from orders (name + phone), so nothing is stored twice.
import { getOrders } from './orderService'

export async function getCustomers() {
  const map = new Map()
  for (const o of await getOrders()) {
    if (!o.customerName) continue
    const key = `${o.customerName.toLowerCase()}|${o.customerPhone}`
    const c = map.get(key) || { id: key, name: o.customerName, phone: o.customerPhone, address: o.address, orders: 0, spent: 0, last: '', delivered: 0 }
    c.orders++
    if (o.status !== 'Cancelled') c.spent += o.total
    if (o.status === 'Delivered') c.delivered++
    if (!c.last || o.createdAt > c.last) { c.last = o.createdAt; c.address = o.address || c.address }
    map.set(key, c)
  }
  return [...map.values()].sort((a, b) => b.spent - a.spent)
}
