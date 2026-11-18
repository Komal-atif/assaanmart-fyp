import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAsync from '../hooks/useAsync'
import { useToast } from '../context/ToastContext'
import AsyncView from '../components/ui/AsyncView'
import DataTable from '../components/ui/DataTable'
import StatusBadge from '../components/ui/StatusBadge'
import EmptyState from '../components/ui/EmptyState'
import Avatar from '../components/ui/Avatar'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import { getOrders, updateOrderStatus, ORDER_STATUSES } from '../services/orderService'
import { STATUS_GROUPS } from '../services/analyticsService'
import { formatPKR, formatDate, formatDateTime, orderNo } from '../utils/format'
import { downloadCsv } from '../utils/csv'

const GROUPS = ['All', ...STATUS_GROUPS.map((g) => g.key)]
const RANGES = [['all', 'All time'], ['1', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days']]
const inGroup = (o, g) => g === 'All' || STATUS_GROUPS.find((x) => x.key === g)?.match.includes(o.status)

// the "..." menu of a row: change the status quickly. Fixed position so the table never clips it.
function RowMenu({ order, onPick }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    if (!pos) return undefined
    const close = () => setPos(null)
    const down = (e) => { if (!ref.current?.contains(e.target)) close() }
    window.addEventListener('scroll', close, true); window.addEventListener('resize', close); document.addEventListener('mousedown', down)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); document.removeEventListener('mousedown', down) }
  }, [pos])
  function open(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const up = r.bottom + 270 > window.innerHeight
    setPos({ right: window.innerWidth - r.right, top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined })
  }
  return (
    <span ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn" aria-label="More actions" onClick={(e) => (pos ? setPos(null) : open(e))}><Icon name="more" size={18} /></button>
      {pos && (
        <div className="popover fixed" style={pos}>
          <div className="pop-title">Mark as</div>
          {ORDER_STATUSES.map((s) => (
            <button key={s} disabled={s === order.status} onClick={() => { setPos(null); onPick(s) }}><StatusBadge status={s} /></button>
          ))}
        </div>
      )}
    </span>
  )
}

export default function Orders() {
  const state = useAsync(getOrders)
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [panel, setPanel] = useState(false)
  const [range, setRange] = useState('all')
  const [pay, setPay] = useState('')
  const group = GROUPS.includes(params.get('status')) ? params.get('status') : 'All'
  // orders placed since the last visit get a green flash
  const lastSeen = useRef(Number(localStorage.getItem('assanmart:orders-seen')) || Date.now())
  useEffect(() => { localStorage.setItem('assanmart:orders-seen', String(Date.now())) }, [])

  async function change(o, status) {
    try { await updateOrderStatus(o.id, status); toast(`Order ${orderNo(o.id)} marked as ${status}`); state.reload() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="page">
      <AsyncView state={state}>
        {(orders) => {
          const term = q.trim().toLowerCase()
          const since = range === 'all' ? 0 : Date.now() - Number(range) * 86400000
          const rows = orders.filter((o) => inGroup(o, group) && (!pay || o.paymentMethod === pay) && new Date(o.createdAt).getTime() >= since &&
            (!term || String(o.id).toLowerCase().includes(term) || o.customerName.toLowerCase().includes(term)))
          const payments = [...new Set(orders.map((o) => o.paymentMethod).filter(Boolean))]
          const filtered = range !== 'all' || pay

          function exportCsv() {
            downloadCsv(`assanmart-orders-${new Date().toISOString().slice(0, 10)}.csv`, [
              ['Order ID', 'Customer', 'Phone', 'Address', 'Items', 'Amount (PKR)', 'Payment', 'Status', 'Placed'],
              ...rows.map((o) => [o.id, o.customerName, o.customerPhone, o.address, o.items.length, o.total, o.paymentMethod, o.status, formatDateTime(o.createdAt)]),
            ])
            toast(`Exported ${rows.length} orders`)
          }

          return (
            <>
              <div className="page-head">
                <div><h1>Orders</h1></div>
                <div className="head-actions">
                  <Button variant="ghost" icon="download" onClick={exportCsv} disabled={rows.length === 0}>Export</Button>
                  <Button icon="filter" onClick={() => setPanel(!panel)} className={filtered ? 'has-filter' : ''}>Filter</Button>
                </div>
              </div>

              {panel && (
                <div className="card filter-panel">
                  <div className="field"><label htmlFor="range">Date</label>
                    <select id="range" value={range} onChange={(e) => setRange(e.target.value)}>{RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                  <div className="field"><label htmlFor="pay">Payment</label>
                    <select id="pay" value={pay} onChange={(e) => setPay(e.target.value)}><option value="">Any payment</option>{payments.map((p) => <option key={p}>{p}</option>)}</select></div>
                  <Button variant="soft" size="sm" onClick={() => { setRange('all'); setPay('') }}>Clear filters</Button>
                </div>
              )}

              <div className="card">
                {orders.length === 0 ? (
                  <EmptyState icon="orders" title="No orders yet" text="Orders placed through the AssanMart voice agent will appear here." />
                ) : (
                  <>
                    <div className="toolbar">
                      <div className="chips">
                        {GROUPS.map((g) => (
                          <button key={g} className={`chip c-${g} ${group === g ? 'on' : ''}`} onClick={() => setParams(g === 'All' ? {} : { status: g })}>
                            {g} <em>{orders.filter((o) => inGroup(o, g)).length}</em>
                          </button>
                        ))}
                      </div>
                      <label className="search-box"><Icon name="search" size={16} /><input placeholder="Search order or customer…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" /></label>
                    </div>
                    <DataTable rows={rows} pageSize={12} onRowClick={(o) => navigate(`/orders/${o.id}`)}
                      rowClass={(o) => (new Date(o.createdAt).getTime() > lastSeen.current ? 'row-new' : '')}
                      empty={<EmptyState title="No matching orders" text="Try another status or search." />}
                      columns={[
                        { key: 'id', header: 'Order ID', render: (o) => <strong className="oid">{orderNo(o.id)}</strong> },
                        { key: 'customer', header: 'Customer', render: (o) => <span className="who-cell"><Avatar name={o.customerName} size={32} />{o.customerName || '—'}</span> },
                        { key: 'items', header: 'Items', render: (o) => `${o.items.length} item${o.items.length === 1 ? '' : 's'}` },
                        { key: 'total', header: 'Amount', render: (o) => <strong>{formatPKR(o.total)}</strong> },
                        { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
                        { key: 'createdAt', header: 'Date', render: (o) => formatDate(o.createdAt) },
                        { key: 'action', header: 'Action', render: (o) => (
                          <div className="actions" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/orders/${o.id}`)}>View</Button>
                            <RowMenu order={o} onPick={(s) => change(o, s)} />
                          </div>) },
                      ]} />
                  </>
                )}
              </div>
            </>
          )
        }}
      </AsyncView>
    </div>
  )
}
