import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import useAsync from '../hooks/useAsync'
import useAutoRefresh from '../hooks/useAutoRefresh'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import { downloadCsv } from '../utils/csv'
import AsyncView from '../components/ui/AsyncView'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import { AreaChart, BarChart, HBars, Donut } from '../components/ui/Charts'
import { getAnalytics } from '../services/analyticsService'
import { getStockSummary } from '../services/inventoryService'
import { formatPKR, formatShort, catLabel } from '../utils/format'

async function load(days) {
  const [a, stock] = await Promise.all([getAnalytics(days), getStockSummary()])
  return { a, stock }
}
const empty = <EmptyState icon="analytics" title="No orders in this period" />

export default function Analytics() {
  const [days, setDays] = useState(7)
  const [metric, setMetric] = useState('sales')
  const navigate = useNavigate()
  const state = useAsync(() => load(days), [days])
  const updated = useAutoRefresh(state)
  const exportCsv = () => {
    const a = state.data?.a
    if (!a) return
    downloadCsv(`assanmart-analytics-${days}d.csv`, [['Date', 'Sales (PKR)', 'Orders'], ...a.series.map((s) => [s.key, s.value, s.orders])])
  }
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Analytics</h1><p>Sales, orders and stock, calculated from your data.</p></div>
        <div className="chips">
          <button className={`icon-btn round refresh ${state.loading ? 'spin' : ''}`} onClick={state.reload} aria-label="Refresh" title={`Updated ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}><Icon name="refresh" size={17} /></button>
          <Button variant="ghost" icon="download" size="sm" onClick={exportCsv} disabled={!state.data?.a.hasPeriodOrders}>Export</Button>
          {[7, 30, 60].map((d) => <button key={d} className={`chip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>Last {d} days</button>)}
        </div>
      </div>
      <AsyncView state={state}>
        {({ a, stock }) => {
          const bestDay = a.series.reduce((b, s) => (s.value > b.value ? s : b), a.series[0])
          const bestHour = a.hours.reduce((b, h) => (h.count > b.count ? h : b), a.hours[0])
          const top = a.topProducts[0]
          const insights = a.hasPeriodOrders ? [
            { icon: 'calendar', tone: 'green', label: 'Best day', value: bestDay.fullLabel, sub: formatPKR(Math.round(bestDay.value)), to: '/orders' },
            { icon: 'receipt', tone: 'blue', label: 'Busiest hour', value: bestHour.label.replace('a', ' AM').replace('p', ' PM'), sub: `${bestHour.count} orders`, to: '/orders' },
            top && { icon: 'products', tone: 'amber', label: 'Top product', value: top.name, sub: `${top.quantity} sold`, to: `/products?q=${encodeURIComponent(top.name)}` },
            { icon: 'check', tone: 'purple', label: 'Success rate', value: `${Math.round((a.delivered / Math.max(1, a.totals.orders)) * 100)}%`, sub: `${a.cancelled} cancelled`, to: '/orders?status=Cancelled' },
          ].filter(Boolean) : []
          return (
            <>
            {insights.length > 0 && (
              <div className="insights">
                {insights.map((n, i) => (
                  <Link key={n.label} to={n.to} className={`insight t-${n.tone}`} style={{ '--i': i }}>
                    <span className={`stat-ico t-${n.tone}`}><Icon name={n.icon} size={18} /></span>
                    <span className="in-text"><small>{n.label}</small><strong title={n.value}>{n.value}</strong><em>{n.sub}</em></span>
                  </Link>
                ))}
              </div>
            )}
            <div className="grid-4">
              <StatCard label="Total Sales" icon="up" tone="green" value={a.totals.sales} format={(v) => formatPKR(Math.round(v))} trend={a.trends.sales} hint="vs previous period" />
              <StatCard label="Orders" icon="orders" tone="blue" value={a.totals.orders} trend={a.trends.orders} hint={`${a.cancelled} cancelled`} to="/orders" />
              <StatCard label="Average Order" icon="receipt" tone="purple" value={a.totals.aov} format={(v) => formatPKR(Math.round(v))} trend={a.trends.aov} />
              <StatCard label="Delivered" icon="truck" tone="amber" value={a.totals.orders ? (a.delivered / a.totals.orders) * 100 : 0} format={(v) => `${Math.round(v)}%`} hint={`${a.delivered} orders`} />
            </div>
            <div className="card">
              <div className="card-head"><h2>{metric === 'sales' ? 'Sales per day' : 'Orders per day'}</h2>
                <span className="chips seg">{[['sales', 'Sales'], ['orders', 'Orders']].map(([k, l]) => <button key={k} className={`chip ${metric === k ? 'on' : ''}`} onClick={() => setMetric(k)}>{l}</button>)}</span></div>
              {a.hasPeriodOrders ? <AreaChart data={metric === 'sales' ? a.series : a.series.map((s) => ({ ...s, value: s.orders }))} format={metric === 'sales' ? (v) => formatPKR(Math.round(v)) : (v) => `${v} orders`} color={metric === 'sales' ? '#2f8f5b' : '#4a9bd0'} height={300} /> : empty}
            </div>
            <div className="grid-eq">
              <div className="card"><div className="card-head"><h2>Orders per day</h2></div>
                {a.hasPeriodOrders ? <BarChart data={a.series.map((s) => ({ label: s.label, fullLabel: s.fullLabel, value: s.orders }))} labelEvery={days > 7 ? Math.ceil(days / 8) : 1} unit=" orders" /> : empty}</div>
              <div className="card"><div className="card-head"><h2>Peak order hours</h2></div>
                {a.hasPeriodOrders ? <BarChart data={a.hours.map((h) => ({ label: h.label, value: h.count }))} labelEvery={3} unit=" orders" /> : empty}</div>
              <div className="card"><div className="card-head"><h2>Top selling products</h2></div>
                {a.topProducts.length ? <HBars onSelect={(d) => navigate(`/products?q=${encodeURIComponent(d.label)}`)} data={a.topProducts.map((t) => ({ label: t.name, value: t.quantity, display: `${t.quantity} sold` }))} /> : empty}</div>
              <div className="card"><div className="card-head"><h2>Sales by category</h2></div>
                {a.byCategory.length ? <HBars onSelect={(d) => navigate(`/products?category=${encodeURIComponent(d.raw)}`)} data={a.byCategory.map((c) => ({ raw: c.name, label: catLabel(c.name), value: c.value, display: `Rs ${formatShort(c.value)}` }))} /> : empty}</div>
              <div className="card"><div className="card-head"><h2>Order status</h2></div>
                {a.hasPeriodOrders ? <Donut centerLabel="Total Orders" onSelect={(d) => navigate(`/orders?status=${d.label}`)} data={a.statusGroups.map((g) => ({ label: g.key, value: g.count, color: g.color }))} /> : empty}</div>
              <div className="card"><div className="card-head"><h2>Stock overview</h2></div>
                <Donut centerLabel="Products" onSelect={(d) => { const k = { 'In Stock': 'in', 'Low Stock': 'low', 'Out of Stock': 'out' }[d.label]; if (k) navigate(`/products?stock=${k}`) }} data={[
                  { label: 'In Stock', value: stock.in, color: '#2f8f5b' }, { label: 'Low Stock', value: stock.low, color: '#f0a63a' },
                  { label: 'Out of Stock', value: stock.out, color: '#e0594f' }, { label: 'Stock not set', value: stock.unset, color: '#9fb5a8' },
                  { label: 'Inactive', value: stock.inactive, color: '#cdd8d1' },
                ]} /></div>
            </div>
          </>
          )
        }}
      </AsyncView>
    </div>
  )
}
