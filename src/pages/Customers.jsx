import { useState } from 'react'
import useAsync from '../hooks/useAsync'
import AsyncView from '../components/ui/AsyncView'
import StatCard from '../components/ui/StatCard'
import DataTable from '../components/ui/DataTable'
import EmptyState from '../components/ui/EmptyState'
import Avatar from '../components/ui/Avatar'
import Icon from '../components/ui/Icon'
import { getCustomers } from '../services/customerService'
import { formatPKR, formatDate } from '../utils/format'

export default function Customers() {
  const state = useAsync(getCustomers)
  const [q, setQ] = useState('')
  return (
    <div className="page">
      <div className="page-head"><div><h1>Customers</h1></div></div>
      <AsyncView state={state}>
        {(list) => {
          const term = q.trim().toLowerCase()
          const rows = list.filter((c) => !term || c.name.toLowerCase().includes(term) || c.phone.includes(term))
          const repeat = list.filter((c) => c.orders > 1).length
          const spent = list.reduce((s, c) => s + c.spent, 0)
          return (
            <>
              <div className="grid-3eq">
                <StatCard label="Customers" icon="customers" tone="blue" value={list.length} />
                <StatCard label="Repeat customers" icon="refresh" tone="green" value={repeat} hint="ordered more than once" />
                <StatCard label="Average spend" icon="receipt" tone="purple" value={list.length ? spent / list.length : 0} format={(v) => formatPKR(Math.round(v))} />
              </div>
              <div className="card">
                <div className="toolbar"><label className="search-box wide"><Icon name="search" size={16} /><input placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" /></label></div>
                <DataTable rows={rows} rowKey="id" pageSize={12}
                  empty={<EmptyState icon="customers" title="No customers yet" text="Customers appear after the first order." />}
                  columns={[
                    { key: 'name', header: 'Customer', render: (c) => <span className="who-cell"><Avatar name={c.name} size={34} /><span><strong>{c.name}</strong><small className="block muted">{c.phone || '—'}</small></span></span> },
                    { key: 'address', header: 'Address', render: (c) => <span className="muted">{c.address || '—'}</span> },
                    { key: 'orders', header: 'Orders', render: (c) => c.orders },
                    { key: 'spent', header: 'Total spent', align: 'right', render: (c) => <strong>{formatPKR(c.spent)}</strong> },
                    { key: 'last', header: 'Last order', render: (c) => formatDate(c.last) },
                  ]} />
              </div>
            </>
          )
        }}
      </AsyncView>
    </div>
  )
}
