import { useState } from 'react'
import { Link } from 'react-router-dom'
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
import { getLowStock, getStockNotSet } from '../services/inventoryService'
import { getLowStockLimit } from '../services/settingsService'
import { catLabel } from '../utils/format'

async function load() {
  const [items, unset, limit] = await Promise.all([getLowStock(), getStockNotSet(), getLowStockLimit()])
  return { items, unset: unset.length, limit }
}

export default function LowStock() {
  const state = useAsync(load)
  const toast = useToast()
  const [editing, setEditing] = useState(null)

  return (
    <div className="page">
      <AsyncView state={state}>
        {({ items, unset, limit }) => {
          const out = items.filter((p) => p.stockStatus === 'out').length
          const low = items.length - out
          return (
            <>
              <div className="page-head">
                <div><h1>Low Stock</h1>
                  <p>Products with {limit} or fewer left, and products that are out of stock. Change the limit in <Link className="link-btn inline" to="/settings">Settings</Link>.</p></div>
              </div>
              <div className="grid-eq">
                <div className="card alert-card red"><span className="alert-ico"><Icon name="x" size={22} /></span><div><strong>{out}</strong><span>Out of stock</span></div></div>
                <div className="card alert-card amber"><span className="alert-ico"><Icon name="alert" size={22} /></span><div><strong>{low}</strong><span>Low stock</span></div></div>
              </div>
              <div className="card">
                <DataTable rows={items} pageSize={15}
                  empty={<EmptyState icon="check" title="Nothing is low on stock" text="No product is at or below the limit right now." />}
                  columns={[
                    { key: 'name', header: 'Product', render: (p) => (
                      <div className="cell-product"><ProductImage src={p.imageUrl} alt={p.name} category={p.category} /><div><strong>{p.name}</strong><small>{p.subcategory || catLabel(p.category)}</small></div></div>) },
                    { key: 'stock', header: 'Left', render: (p) => <strong className={`big-q s-${p.stockStatus}-text`}>{p.stockQuantity}</strong> },
                    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.stockStatus} /> },
                    { key: 'actions', header: '', render: (p) => <div className="actions"><Button size="sm" icon="plus" variant={p.stockStatus === 'out' ? 'danger' : 'amber'} onClick={() => setEditing(p)}>Restock</Button></div> },
                  ]} />
              </div>
              {unset > 0 && <p className="hint">{unset} products have no stock number yet and are not counted here. <Link className="link-btn inline" to="/inventory?status=unset">Fill them in</Link></p>}
            </>
          )
        }}
      </AsyncView>
      {editing && <StockModal product={editing} onClose={() => setEditing(null)}
        onSaved={(p, qty) => { setEditing(null); toast(`${p.name} now has ${qty} in stock`); state.reload() }} />}
    </div>
  )
}
