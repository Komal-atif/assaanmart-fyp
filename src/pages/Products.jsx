import { useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
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
import { setActive } from '../services/productService'
import { formatPKR, formatPackage, formatStock, catLabel } from '../utils/format'
import { STOCK_LABEL } from '../utils/stock'
import { matchesProduct } from '../utils/search'

const PAGE = 24
const SORTS = {
  name: ['Name A–Z', (a, b) => a.name.localeCompare(b.name)],
  'price-asc': ['Price: low to high', (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9)],
  'price-desc': ['Price: high to low', (a, b) => (b.price ?? -1) - (a.price ?? -1)],
  'stock-asc': ['Stock: low first', (a, b) => (a.stockQuantity ?? 1e9) - (b.stockQuantity ?? 1e9)],
}

function stockText(p) {
  if (p.stockStatus === 'in') return `${p.stockQuantity} in stock`
  if (p.stockStatus === 'low') return `Only ${p.stockQuantity} left`
  return STOCK_LABEL[p.stockStatus]
}

export default function Products() {
  const state = useAsync(getInventory)
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('grid')
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState(null)
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const sub = params.get('sub') ?? ''
  const stockF = params.get('stock') ?? ''
  const sort = params.get('sort') ?? 'name'

  const setParam = (key, value, extra = {}) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    Object.entries(extra).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
    setLimit(PAGE)
  }

  async function toggle(p) {
    await setActive(p.id, !p.isActive)
    toast(`${p.name} is now ${p.isActive ? 'inactive' : 'active'}`)
    state.reload()
  }

  return (
    <div className="page">
      <AsyncView state={state}>
        {(products) => {
          const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort()
          const subs = category ? [...new Set(products.filter((p) => p.category === category).map((p) => p.subcategory).filter(Boolean))].sort() : []
          const rows = products
            .filter((p) => matchesProduct(p, q) && (!category || p.category === category) && (!sub || p.subcategory === sub) && (!stockF || p.stockStatus === stockF))
            .sort(SORTS[sort]?.[1] || SORTS.name[1])
          const shown = rows.slice(0, limit)
          const hasDemo = products.some((p) => p.stockIsDemo)
          const count = (c) => products.filter((p) => p.category === c).length

          return (
            <>
              <div className="page-head">
                <div><h1>Products</h1></div>
                <div className="head-actions">
                  <label className="search-box"><Icon name="search" size={16} />
                    <input placeholder="Search products…" value={q} onChange={(e) => setParam('q', e.target.value)} aria-label="Search products" />
                  </label>
                  <Button icon="plus" onClick={() => navigate('/products/new')}>Add Product</Button>
                </div>
              </div>

              <div className="chips scroll" role="tablist" aria-label="Categories">
                <button className={`chip ${!category ? 'on' : ''}`} onClick={() => setParam('category', '', { sub: '' })}>All <em>{products.length}</em></button>
                {categories.map((c) => (
                  <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setParam('category', c, { sub: '' })}>{catLabel(c)} <em>{count(c)}</em></button>
                ))}
              </div>
              {subs.length > 1 && (
                <div className="chips scroll small">
                  <button className={`chip sm ${!sub ? 'on' : ''}`} onClick={() => setParam('sub', '')}>All {catLabel(category)}</button>
                  {subs.map((s) => <button key={s} className={`chip sm ${sub === s ? 'on' : ''}`} onClick={() => setParam('sub', s)}>{s}</button>)}
                </div>
              )}

              <div className="toolbar">
                <span className="muted">{rows.length} product{rows.length === 1 ? '' : 's'}</span>
                <div className="toolbar-right">
                  <select value={stockF} onChange={(e) => setParam('stock', e.target.value)} aria-label="Stock filter" className={stockF ? `sel-${stockF}` : ''}>
                    <option value="">All stock levels</option>
                    <option value="in">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option>
                    <option value="unset">Stock not set</option><option value="inactive">Inactive</option>
                  </select>
                  <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'name' ? '' : e.target.value)} aria-label="Sort">
                    {Object.entries(SORTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <div className="seg" role="group" aria-label="View">
                    <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Icon name="grid" size={16} /></button>
                    <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="List view"><Icon name="list" size={16} /></button>
                  </div>
                </div>
              </div>
              {hasDemo && <p className="hint demo-hint"><Icon name="info" size={14} /> Products with an empty stock cell in your Excel show a sample stock number. Real numbers from Excel are never changed. Turn this off in Settings → Demo data.</p>}

              {rows.length === 0 ? (
                <div className="card"><EmptyState title="No products found" text="Try a different search or filter." /></div>
              ) : view === 'grid' ? (
                <>
                  <div className="pgrid">
                    {shown.map((p, i) => (
                      <article key={p.id} className={`pcard ${p.isActive ? '' : 'inactive'}`} style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}
                        tabIndex={0} onClick={() => navigate(`/products/${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/products/${p.id}`)}>
                        <div className="pcard-img">
                          <ProductImage fill src={p.imageUrl} alt={p.name} category={p.category} />
                          <span className={`pill s-${p.stockStatus}`}>{STOCK_LABEL[p.stockStatus]}</span>
                        </div>
                        <h3 title={p.name}>{p.name}</h3>
                        <p className="pmeta">{[p.brand, formatPackage(p) !== '—' ? formatPackage(p) : null].filter(Boolean).join(' · ') || catLabel(p.category)}</p>
                        <div className="pcard-foot">
                          <div>
                            <strong className="price">{p.price === null ? 'Price not set' : formatPKR(p.price)}</strong>
                            <span className={`pstock s-${p.stockStatus}-text`}>{stockText(p)}</span>
                          </div>
                          <button className="add-btn" aria-label={`Add stock for ${p.name}`} title="Add stock" onClick={(e) => { e.stopPropagation(); setEditing(p) }}><Icon name="plus" size={18} stroke={2.4} /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {rows.length > shown.length && (
                    <div className="more"><Button variant="soft" onClick={() => setLimit(limit + PAGE)}>Show more ({rows.length - shown.length} left)</Button></div>
                  )}
                </>
              ) : (
                <div className="card">
                  <DataTable rows={rows} pageSize={20} onRowClick={(p) => navigate(`/products/${p.id}`)}
                    columns={[
                      { key: 'name', header: 'Product', render: (p) => (
                        <div className="cell-product"><ProductImage src={p.imageUrl} alt={p.name} category={p.category} />
                          <div><strong>{p.name}</strong><small>{[p.brand, p.subcategory].filter(Boolean).join(' · ')}</small></div></div>) },
                      { key: 'category', header: 'Category', render: (p) => catLabel(p.category) },
                      { key: 'package', header: 'Pack', render: (p) => formatPackage(p) },
                      { key: 'price', header: 'Price', align: 'right', render: (p) => formatPKR(p.price) },
                      { key: 'stock', header: 'Stock', render: (p) => <>{formatStock(p.stockQuantity)} <StatusBadge status={p.stockStatus} /></> },
                      { key: 'actions', header: '', render: (p) => (
                        <div className="actions" onClick={(e) => e.stopPropagation()}>
                          <Link className="btn blue sm" to={`/products/${p.id}`}><span>Edit</span></Link>
                          <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.isActive ? 'Deactivate' : 'Activate'}</Button>
                        </div>) },
                    ]} />
                </div>
              )}
            </>
          )
        }}
      </AsyncView>
      {editing && <StockModal product={editing} onClose={() => setEditing(null)}
        onSaved={(p, qty) => { setEditing(null); toast(`${p.name} now has ${qty} in stock`); state.reload() }} />}
    </div>
  )
}