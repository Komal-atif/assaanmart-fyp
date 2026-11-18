import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useAsync from '../hooks/useAsync'
import { useToast } from '../context/ToastContext'
import AsyncView from '../components/ui/AsyncView'
import DataTable from '../components/ui/DataTable'
import StatusBadge from '../components/ui/StatusBadge'
import ProductImage from '../components/ui/ProductImage'
import EmptyState from '../components/ui/EmptyState'
import StockModal from '../components/ui/StockModal'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import { getInventory } from '../services/inventoryService'
import { formatStock, catLabel } from '../utils/format'
import { matchesProduct } from '../utils/search'

const TILES = [['all', 'All products', 'products'], ['in', 'In Stock', 'check'], ['low', 'Low Stock', 'alert'], ['out', 'Out of Stock', 'x'], ['unset', 'Stock not set', 'info'], ['inactive', 'Inactive', 'eyeoff']]

export default function Inventory() {
  const state = useAsync(getInventory)
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const status = params.get('status') || 'all'

  return (
    <div className="page">
      <div className="page-head"><div><h1>Inventory</h1></div></div>
      <AsyncView state={state}>
        {(items) => {
          const count = (s) => (s === 'all' ? items.length : items.filter((p) => p.stockStatus === s).length)
          const rows = items.filter((p) => (status === 'all' || p.stockStatus === status) && matchesProduct(p, q))
          return (
            <>
              <div className="tiles">
                {TILES.map(([key, label, icon]) => (
                  <button key={key} className={`tile s-${key} ${status === key ? 'on' : ''}`} onClick={() => setParams(key === 'all' ? {} : { status: key })}>
                    <span className="tile-ico"><Icon name={icon} size={18} /></span>
                    <strong>{count(key)}</strong><span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="card">
                <div className="toolbar">
                  <label className="search-box wide"><Icon name="search" size={16} /><input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inventory" /></label>
                </div>
                <DataTable rows={rows} pageSize={15}
                  empty={<EmptyState title="No products here" text="Try another filter or search." />}
                  columns={[
                    { key: 'name', header: 'Product', render: (p) => (
                      <div className="cell-product"><ProductImage src={p.imageUrl} alt={p.name} category={p.category} /><div><strong>{p.name}</strong><small>{p.subcategory || catLabel(p.category)}</small></div></div>) },
                    { key: 'level', header: 'Stock level', render: (p) => (
                      <div className="stockbar-wrap"><div className={`stockbar s-${p.stockStatus}`}><i style={{ width: `${Math.min(100, ((p.stockQuantity || 0) / 80) * 100)}%` }} /></div><strong>{formatStock(p.stockQuantity)}</strong></div>) },
                    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.stockStatus} /> },
                    { key: 'actions', header: '', render: (p) => (
                      <div className="actions">
                        <Button size="sm" icon="edit" variant={p.stockStatus === 'out' ? 'danger' : p.stockStatus === 'low' ? 'amber' : 'blue'} onClick={() => setEditing(p)}>
                          {p.stockStatus === 'out' || p.stockStatus === 'low' ? 'Restock' : 'Edit'}
                        </Button>
                      </div>) },
                  ]} />
              </div>
            </>
          )
        }}
      </AsyncView>
      {editing && <StockModal product={editing} onClose={() => setEditing(null)}
        onSaved={(p, qty) => { setEditing(null); toast(`${p.name} now has ${qty} in stock`); state.reload() }} />}
    </div>
  )
}
