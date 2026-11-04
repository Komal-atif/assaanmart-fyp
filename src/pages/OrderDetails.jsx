import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import useAsync from '../hooks/useAsync'
import { useToast } from '../context/ToastContext'
import AsyncView from '../components/ui/AsyncView'
import StatusBadge from '../components/ui/StatusBadge'
import EmptyState from '../components/ui/EmptyState'
import ProductImage from '../components/ui/ProductImage'
import Avatar from '../components/ui/Avatar'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import { getOrder, updateOrderStatus, ORDER_STATUSES } from '../services/orderService'
import { getProducts } from '../services/productService'
import { formatPKR, formatDateTime, orderNo } from '../utils/format'

const FLOW = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered']

function Detail({ order, products, onChanged }) {
  const toast = useToast()
  const [status, setStatus] = useState(order.status)
  const [saving, setSaving] = useState(false)
  const step = FLOW.indexOf(order.status)

  async function save() {
    setSaving(true)
    try { await updateOrderStatus(order.id, status); toast(`Order ${orderNo(order.id)} is now ${status}`); onChanged() }
    catch (e) { toast(e.message, 'error') }
    setSaving(false)
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Order {orderNo(order.id)}</h1><p>Placed {formatDateTime(order.createdAt)}</p></div>
        <StatusBadge status={order.status} />
      </div>

      <div className="card">
        {order.status === 'Cancelled' ? (
          <div className="cancelled-banner"><Icon name="x" size={18} />This order was cancelled.</div>
        ) : (
          <ol className="steps">
            {FLOW.map((s, i) => (
              <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
                <span className="step-dot">{i < step ? <Icon name="check" size={14} stroke={3} /> : i + 1}</span>
                <span className="step-name">{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid-eq">
        <div className="card">
          <h2 className="mb">Customer</h2>
          <div className="who-cell big"><Avatar name={order.customerName} size={46} /><div><strong>{order.customerName || '—'}</strong><span className="muted">{order.customerPhone || 'No phone'}</span></div></div>
          <p style={{ marginTop: 12 }}>{order.address || 'No address'}</p>
          <p className="muted" style={{ marginTop: 8 }}>Payment: {order.paymentMethod || '—'}</p>
        </div>
        <div className="card">
          <h2 className="mb">Update status</h2>
          <div className="field">
            <label htmlFor="status">Order status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <Button onClick={save} loading={saving} disabled={status === order.status}>{saving ? 'Saving…' : 'Update status'}</Button>
        </div>
      </div>

      <div className="card">
        <h2 className="mb">Items</h2>
        {order.items.length === 0 ? <EmptyState title="No items" /> : order.items.map((i) => {
          const p = products.get(i.productId)
          return (
            <div className="list-row" key={`${i.productId}-${i.name}`}>
              <ProductImage src={p?.imageUrl} alt={i.name} size={48} category={p?.category} />
              <div className="grow"><strong>{i.name}</strong><span className="muted">{formatPKR(i.price)} × {i.quantity}</span></div>
              <strong>{formatPKR(i.price * i.quantity)}</strong>
            </div>
          )
        })}
        <div className="total-row"><span className="muted">Order total</span><strong>{formatPKR(order.total)}</strong></div>
      </div>
    </>
  )
}

export default function OrderDetails() {
  const { id } = useParams()
  const state = useAsync(async () => {
    const [order, all] = await Promise.all([getOrder(id), getProducts()])
    return { order, products: new Map(all.map((p) => [p.id, p])) }
  }, [id])
  return (
    <div className="page">
      <Link className="back-link" to="/orders"><Icon name="back" size={16} />Back to orders</Link>
      <AsyncView state={state}>
        {({ order, products }) => order
          ? <Detail key={`${order.id}-${order.status}`} order={order} products={products} onChanged={state.reload} />
          : <div className="card"><EmptyState icon="orders" title="Order not found" text="This order does not exist." /></div>}
      </AsyncView>
    </div>
  )
}
