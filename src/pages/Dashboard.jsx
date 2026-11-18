import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAsync from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AsyncView from '../components/ui/AsyncView'
import StatCard from '../components/ui/StatCard'
import DataTable from '../components/ui/DataTable'
import StatusBadge from '../components/ui/StatusBadge'
import ProductImage from '../components/ui/ProductImage'
import EmptyState from '../components/ui/EmptyState'
import Avatar from '../components/ui/Avatar'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import StockModal from '../components/ui/StockModal'
import { AreaChart, BarChart, Donut, HBars } from '../components/ui/Charts'
import { getAnalytics } from '../services/analyticsService'
import { getLowStock, getStockSummary } from '../services/inventoryService'
import useAutoRefresh from '../hooks/useAutoRefresh'
import { formatPKR, formatShort, formatDate, catLabel, orderNo } from '../utils/format'

const PERIODS = [[7, 'Last 7 days'], [30, 'Last 30 days'], [60, 'Last 60 days']]

async function load(days) {
  const [a, low, stock] = await Promise.all([getAnalytics(days), getLowStock(), getStockSummary()])
  return { a, low, stock }
}

export default function Dashboard() {
  const { admin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [days, setDays] = useState(7)
  const [editing, setEditing] = useState(null)
  const [metric, setMetric] = useState('sales')
  const state = useAsync(() => load(days), [days])
  const updated = useAutoRefresh(state)
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const periodSelect = (
    <label className="select-pill">
      <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time period">
        {PERIODS.map(([d, l]) => <option key={d} value={d}>{l}</option>)}
      </select>
      <Icon name="chevron" size={14} />
    </label>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Welcome, {admin?.name || 'Madeeha Naeem'}! </h1>
         </div>
        <div className="head-actions">
          <button className={`icon-btn round refresh ${state.loading ? 'spin' : ''}`} onClick={state.reload} aria-label="Refresh" title={`Updated ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}><Icon name="refresh" size={17} /></button>
          <div className="date-pill"><Icon name="calendar" size={15} />Today, {today}</div>
        </div>
      </div>

      <AsyncView state={state}>
        {({ a, low, stock }) => (
          <>
            <div className="grid-4">
              <StatCard label="Total Sales" icon="up" tone="green" value={a.totals.sales} format={(v) => formatPKR(Math.round(v))} trend={a.trends.sales} hint={`vs previous ${a.days} days`} />
              <StatCard label="Orders" icon="orders" tone="blue" value={a.totals.orders} trend={a.trends.orders} hint={`${a.delivered} delivered`} to="/orders" />
              <StatCard label="Average Order Value" icon="receipt" tone="purple" value={a.totals.aov} format={(v) => formatPKR(Math.round(v))} trend={a.trends.aov} hint="per order" />
              <StatCard label="Products" icon="products" tone="amber" value={stock.total} hint={`${stock.out} out · ${stock.low} low`} to="/low-stock" />
            </div>

            <div className="grid-chart">
              <div className="card">
                <div className="card-head"><h2>Sales Overview</h2>
                  <span className="head-tools">
                    <span className="chips seg">{[['sales', 'Sales'], ['orders', 'Orders']].map(([k, l]) => <button key={k} className={`chip ${metric === k ? 'on' : ''}`} onClick={() => setMetric(k)}>{l}</button>)}</span>
                    {periodSelect}
                  </span></div>
                {a.hasPeriodOrders
                  ? <AreaChart data={metric === 'sales' ? a.series : a.series.map((s) => ({ ...s, value: s.orders }))} format={metric === 'sales' ? (v) => formatPKR(Math.round(v)) : (v) => `${v} orders`} color={metric === 'sales' ? '#2f8f5b' : '#4a9bd0'} />
                  : <EmptyState icon="analytics" title="No orders in this period" text="Pick a longer period to see sales." />}
              </div>
              <div className="card">
                <div className="card-head"><h2>Order Status</h2></div>
                {a.hasPeriodOrders
                  ? <Donut centerLabel="Total Orders" data={a.statusGroups.map((g) => ({ label: g.key, value: g.count, color: g.color }))}
                      onSelect={(d) => navigate(`/orders?status=${d.label}`)} />
                  : <EmptyState icon="orders" title="No orders yet" />}
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-head"><h2>Recent Orders</h2><Link className="link-btn" to="/orders">View all</Link></div>
                <DataTable
                  rows={a.recent}
                  onRowClick={(o) => navigate(`/orders/${o.id}`)}
                  empty={<EmptyState icon="orders" title="No orders yet" text="Orders from the AssanMart voice agent will appear here." />}
                  columns={[
                    { key: 'id', header: 'Order ID', render: (o) => <strong className="oid">{orderNo(o.id)}</strong> },
                    { key: 'customerName', header: 'Customer', render: (o) => <span className="who-cell"><Avatar name={o.customerName} size={30} />{o.customerName || '—'}</span> },
                    { key: 'total', header: 'Amount', render: (o) => formatPKR(o.total) },
                    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
                    { key: 'createdAt', header: 'Date', render: (o) => formatDate(o.createdAt) },
                  ]}
                />
              </div>

              <div className="card">
                <div className="card-head"><h2>Stock Alerts</h2><Link className="link-btn" to="/low-stock">View all</Link></div>
                {low.length === 0 ? (
                  <EmptyState icon="check" title="All stocked up" text="Nothing is low or out of stock." />
                ) : (
                  low.slice(0, 6).map((p) => (
                    <div className="list-row" key={p.id}>
                      <ProductImage src={p.imageUrl} alt={p.name} size={44} category={p.category} />
                      <div className="grow"><strong>{p.name}</strong><span className={`muted s-${p.stockStatus}-text`}>{p.stockQuantity === 0 ? 'Out of stock' : `${p.stockQuantity} left`}</span></div>
                      <Button size="sm" variant={p.stockStatus === 'out' ? 'danger' : 'amber'} onClick={() => setEditing(p)}>Restock</Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid-3">
              <div className="card">
                <div className="card-head"><h2>Top Selling Products</h2></div>
                {a.topProducts.length ? a.topProducts.slice(0, 5).map((t, i) => (
                  <div className="list-row click" key={t.productId ?? t.name} onClick={() => navigate(`/products?q=${encodeURIComponent(t.name)}`)}>
                    <span className="rank">{i + 1}</span>
                    <ProductImage src={t.imageUrl} alt={t.name} size={40} category={t.category} />
                    <div className="grow"><strong>{t.name}</strong><span className="muted">{formatPKR(t.revenue)}</span></div>
                    <span className="sold">{t.quantity} sold</span>
                  </div>
                )) : <EmptyState icon="products" title="No sales yet" />}
              </div>
              <div className="card">
                <div className="card-head"><h2>Sales by Category</h2></div>
                {a.byCategory.length ? <HBars onSelect={(d) => navigate(`/products?category=${encodeURIComponent(d.raw)}`)} data={a.byCategory.slice(0, 6).map((c) => ({ raw: c.name, label: catLabel(c.name), value: c.value, display: `Rs ${formatShort(c.value)}` }))} /> : <EmptyState icon="analytics" title="No sales yet" />}
              </div>
              <div className="card">
                <div className="card-head"><h2>Peak Order Hours</h2></div>
                {a.hasPeriodOrders ? <BarChart data={a.hours.map((h) => ({ label: h.label, value: h.count }))} labelEvery={3} unit=" orders" height={210} /> : <EmptyState icon="orders" title="No orders yet" />}
              </div>
            </div>
          </>
        )}
      </AsyncView>
      {editing && (
        <StockModal product={editing} onClose={() => setEditing(null)}
          onSaved={(p, q) => { setEditing(null); toast(`${p.name} now has ${q} in stock`); state.reload() }} />
      )}
    </div>
  )
}
